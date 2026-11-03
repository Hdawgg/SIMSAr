// Builds a one-page PDF that stands in for a scanned ITI certificate in the
// demo data. It is clearly marked as a sample; it is not a real certificate.
// (A PDF is plain text plus a table of byte offsets, so no library is needed.)
function samplePdf(lines) {
  const escape = (s) => String(s).replace(/[()\\]/g, (c) => `\\${c}`);
  const content = lines
    .map((line, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 60 ${770 - i * 30} Td (${escape(line)}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((obj, i) => {
    const offset = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return offset;
  });
  const xrefAt = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function sampleCertificatePdf(cert, workerName) {
  return samplePdf([
    'SAMPLE - SIMSAR demo data, not a real certificate',
    `National Trade Certificate (${cert.councilType})`,
    `Name: ${workerName}`,
    `Trade: ${cert.tradeLabel}`,
    `Certificate No: ${cert.certificateNumber}`,
    `Institute: ${cert.instituteName}`,
    `${cert.instituteDistrict}, ${cert.instituteState}`,
    `Year of passing: ${cert.passingYear}`,
  ]);
}

module.exports = { sampleCertificatePdf };
