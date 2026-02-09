import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item) ?? "SIN_SECCION";
    acc[k] = acc[k] || [];
    acc[k].push(item);
    return acc;
  }, {});
}

export function useSupervisionData(supervisionId) {
  const [loading, setLoading] = useState(true);
  const [supervision, setSupervision] = useState(null);
  const [risNombre, setRisNombre] = useState("");
  const [eessNombre, setEessNombre] = useState("");
  const [parametros, setParametros] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [evidencias, setEvidencias] = useState([]);
  const [firmaUrls, setFirmaUrls] = useState({ supervisor: null, digitador: null, medicoJefe: null });

  useEffect(() => {
    if (!supervisionId) return;

    const init = async () => {
      setLoading(true);

      // 1. Supervision
      const { data: sup, error: supErr } = await supabase
        .from("supervisiones")
        .select("*")
        .eq("id", supervisionId)
        .single();

      if (supErr || !sup) {
        setLoading(false);
        return;
      }

      setSupervision(sup);

      // 2. RIS + EESS nombres
      const { data: ris } = await supabase.from("ris").select("nombre").eq("id", sup.ris_id).single();
      setRisNombre(ris?.nombre || "");

      const { data: est } = await supabase.from("establecimientos").select("nombre").eq("id", sup.establecimiento_id).single();
      setEessNombre(est?.nombre || "");

      // 3. Parametros
      const { data: params } = await supabase
        .from("parametros")
        .select("id, seccion, codigo, descripcion, requiere_observacion, orden, activo, tipo_campo_condicional, condicion_campo, etiqueta_campo_condicional")
        .order("seccion", { ascending: true })
        .order("orden", { ascending: true });

      setParametros(params || []);

      // 4. Respuestas
      const { data: resp } = await supabase
        .from("respuestas")
        .select("parametro_id, valor_bool, observacion, valor_fecha, valor_cantidad, valor_texto")
        .eq("supervision_id", supervisionId);

      const map = {};
      (resp || []).forEach((r) => {
        map[r.parametro_id] = {
          valor_bool: r.valor_bool ?? null,
          observacion: r.observacion ?? "",
          valor_fecha: r.valor_fecha ?? null,
          valor_cantidad: r.valor_cantidad ?? null,
          valor_texto: r.valor_texto ?? "",
        };
      });
      setRespuestas(map);

      // 5. Evidencias con signed urls
      const { data: evData } = await supabase
        .from("evidencias")
        .select("id, archivo_url, tipo, created_at, descripcion")
        .eq("supervision_id", supervisionId)
        .order("created_at", { ascending: false });

      const evsWithUrl = [];
      for (const ev of evData || []) {
        let signedUrl = null;
        try {
          const { data: sdata } = await supabase.storage
            .from("evidencias")
            .createSignedUrl(ev.archivo_url, 3600);
          signedUrl = sdata?.signedUrl || null;
        } catch {}
        evsWithUrl.push({ ...ev, signedUrl });
      }
      setEvidencias(evsWithUrl);

      // 6. Firmas signed urls
      const getSignedUrl = async (path) => {
        if (!path) return null;
        try {
          const { data } = await supabase.storage.from("firmas").createSignedUrl(path, 3600);
          return data?.signedUrl || null;
        } catch {
          return null;
        }
      };

      setFirmaUrls({
        supervisor: await getSignedUrl(sup.firma_url),
        digitador: await getSignedUrl(sup.firma_digitador_url),
        medicoJefe: await getSignedUrl(sup.firma_medico_jefe_url),
      });

      setLoading(false);
    };

    init();
  }, [supervisionId]);

  // Agrupar parametros por seccion
  const seccionesAgrupadas = {};
  const activos = (parametros || []).filter((p) => p.activo !== false);
  const grouped = groupBy(activos, (p) => p.seccion || "SIN_SECCION");
  Object.keys(grouped).forEach((k) => {
    seccionesAgrupadas[k] = grouped[k].sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
  });

  return {
    loading,
    supervision,
    risNombre,
    eessNombre,
    parametros,
    respuestas,
    evidencias,
    firmaUrls,
    seccionesAgrupadas,
  };
}
