import * as XLSX from "xlsx";

export function exportSupervisionesToExcel(supervisiones, respuestasMap, parametros) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Supervisiones
  const supRows = supervisiones.map((s) => ({
    "N Correlativo": s.correlativo ?? "",
    Fecha: s.fecha ? new Date(s.fecha).toLocaleDateString() : "",
    RIS: s.ris_nombre || "",
    Establecimiento: s.eess_nombre || "",
    Estado: s.estado || "",
    "Medico Jefe": s.medico_jefe || "",
    Digitador: s.digitador || "",
    "Hora Inicio": s.hora_inicio ? new Date(s.hora_inicio).toLocaleTimeString() : "",
    "Hora Fin": s.hora_fin ? new Date(s.hora_fin).toLocaleTimeString() : "",
    Observaciones: s.observaciones || "",
  }));

  const ws1 = XLSX.utils.json_to_sheet(supRows);
  XLSX.utils.book_append_sheet(wb, ws1, "Supervisiones");

  // Hoja 2: Respuestas detalladas
  if (respuestasMap && parametros) {
    const respRows = [];
    for (const sup of supervisiones) {
      const resps = respuestasMap[sup.id] || {};
      for (const p of parametros) {
        const r = resps[p.id];
        respRows.push({
          Correlativo: sup.correlativo ?? "",
          Fecha: sup.fecha ? new Date(sup.fecha).toLocaleDateString() : "",
          RIS: sup.ris_nombre || "",
          Establecimiento: sup.eess_nombre || "",
          Seccion: p.seccion || "",
          Codigo: p.codigo || "",
          Parametro: p.descripcion || "",
          Cumple: r?.valor_bool === true ? "SI" : r?.valor_bool === false ? "NO" : "",
          Observacion: r?.observacion || "",
        });
      }
    }

    const ws2 = XLSX.utils.json_to_sheet(respRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Respuestas");
  }

  const fileName = `supervisiones_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportSimpleTableToExcel(data, sheetName, fileName) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
