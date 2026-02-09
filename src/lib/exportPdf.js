import jsPDF from "jspdf";
import "jspdf-autotable";

export function exportSupervisionPdf(supervision, respuestas, parametros, risNombre, eessNombre) {
  const doc = new jsPDF();

  // Titulo
  doc.setFontSize(14);
  doc.text("ACTA DE SUPERVISION - AUDITORES", 14, 20);

  // Info general
  doc.setFontSize(9);
  doc.text(`N Correlativo: ${supervision.correlativo ?? "—"}`, 14, 30);
  doc.text(`RIS: ${risNombre || "—"}`, 14, 35);
  doc.text(`Establecimiento: ${eessNombre || "—"}`, 14, 40);
  doc.text(`Fecha: ${supervision.fecha ? new Date(supervision.fecha).toLocaleDateString() : "—"}`, 14, 45);
  doc.text(`Medico Jefe: ${supervision.medico_jefe || "—"}`, 14, 50);
  doc.text(`Digitador: ${supervision.digitador || "—"}`, 14, 55);
  doc.text(`Estado: ${supervision.estado || "—"}`, 140, 30);

  const horaInicio = supervision.hora_inicio
    ? new Date(supervision.hora_inicio).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
  const horaFin = supervision.hora_fin
    ? new Date(supervision.hora_fin).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
  doc.text(`Hora Inicio: ${horaInicio}`, 140, 35);
  doc.text(`Hora Fin: ${horaFin}`, 140, 40);

  // Tabla de respuestas
  const tableData = parametros
    .filter((p) => p.activo !== false)
    .map((p) => {
      const r = respuestas[p.id];
      return [
        p.codigo || "",
        p.descripcion || "",
        r?.valor_bool === true ? "SI" : r?.valor_bool === false ? "NO" : "—",
        r?.observacion || "",
      ];
    });

  doc.autoTable({
    startY: 65,
    head: [["Codigo", "Parametro", "Cumple", "Observacion"]],
    body: tableData,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 80 },
      2: { cellWidth: 15 },
      3: { cellWidth: 70 },
    },
  });

  // Observaciones
  const finalY = doc.lastAutoTable.finalY + 10;
  if (finalY < 260) {
    doc.setFontSize(9);
    doc.text("Observaciones:", 14, finalY);
    doc.setFontSize(8);
    doc.text(supervision.observaciones || "Sin observaciones", 14, finalY + 5, { maxWidth: 180 });
  }

  doc.save(`supervision_${supervision.correlativo || supervision.id}.pdf`);
}

export function exportComplianceReportPdf(statsData, filters) {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("REPORTE DE CUMPLIMIENTO", 14, 20);

  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 28);
  if (filters.fechaDesde) doc.text(`Desde: ${filters.fechaDesde}`, 14, 33);
  if (filters.fechaHasta) doc.text(`Hasta: ${filters.fechaHasta}`, 80, 33);

  const tableData = statsData.map((s) => [
    s.ris_nombre || "—",
    String(s.total_supervisiones || 0),
    String(s.total_respuestas || 0),
    String(s.respuestas_si || 0),
    `${s.porcentaje || 0}%`,
  ]);

  doc.autoTable({
    startY: 40,
    head: [["RIS", "Supervisiones", "Total Resp.", "Cumple (SI)", "% Cumplimiento"]],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
  });

  doc.save(`reporte_cumplimiento_${new Date().toISOString().slice(0, 10)}.pdf`);
}
