import JSZip from 'jszip'

const RECEIPT_CUSTOMERS = new Set([
  'Xí nghiệp khai thác khoáng sản',
  'Xí nghiệp khai thác khoáng sản - Vĩnh Tú',
  'Xí nghiệp khai thác khoáng sản - Vĩnh Thái',
])

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

const textContent = node => Array.from(node.getElementsByTagName('w:t')).map(item => item.textContent || '').join('')
const dateParts = value => {
  const [year, month, day] = (value || '').split('-')
  return { year: year || '', month: month || '', day: day || '' }
}
const dateLong = value => {
  const { year, month, day } = dateParts(value)
  return `ngày ${day} tháng ${month} năm ${year}`
}
const htmlEscape = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]))
const safeFilename = value => String(value || 'phieu').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

const isReceiptOrder = order => RECEIPT_CUSTOMERS.has((order.customerName || '').trim())
const templateFor = order => isReceiptOrder(order) ? '/templates/receipt-template.docx' : '/templates/issue-template.docx'
const formTitleFor = order => isReceiptOrder(order) ? 'PHIẾU BÀN GIAO VẬT TƯ' : 'PHIẾU CẤP VẬT TƯ'

const createTextParagraph = (document, sourceParagraph, value) => {
  const paragraph = sourceParagraph.cloneNode(false)
  const paragraphProperties = sourceParagraph.getElementsByTagName('w:pPr')[0]
  if (paragraphProperties) paragraph.appendChild(paragraphProperties.cloneNode(true))
  const run = document.createElementNS(WORD_NS, 'w:r')
  const sourceRunProperties = sourceParagraph.getElementsByTagName('w:rPr')[0]
  if (sourceRunProperties) run.appendChild(sourceRunProperties.cloneNode(true))
  const text = document.createElementNS(WORD_NS, 'w:t')
  text.setAttribute('xml:space', 'preserve')
  text.textContent = value
  run.appendChild(text)
  paragraph.appendChild(run)
  return paragraph
}

const replaceParagraph = (document, predicate, value) => {
  const paragraphs = Array.from(document.getElementsByTagName('w:p'))
  const paragraph = paragraphs.find(item => predicate(textContent(item)))
  if (!paragraph) return false
  const replacement = createTextParagraph(document, paragraph, value)
  paragraph.parentNode.replaceChild(replacement, paragraph)
  return true
}

const setCellText = (document, cell, value, sourceParagraph) => {
  const properties = cell.getElementsByTagName('w:tcPr')[0]
  Array.from(cell.childNodes).forEach(child => { if (child !== properties) cell.removeChild(child) })
  const paragraph = createTextParagraph(document, sourceParagraph || document.createElementNS(WORD_NS, 'w:p'), value)
  cell.appendChild(paragraph)
}

const fillItemsTable = (document, table, items) => {
  let rows = Array.from(table.getElementsByTagName('w:tr'))
  const templateRow = rows[1] || rows[0]
  while (rows.length - 1 < items.length) {
    const extraRow = templateRow.cloneNode(true)
    table.appendChild(extraRow)
    rows = Array.from(table.getElementsByTagName('w:tr'))
  }
  const templateCells = Array.from(templateRow.getElementsByTagName('w:tc'))
  const templateParagraph = templateCells[0]?.getElementsByTagName('w:p')[0]
  rows.slice(1).forEach((row, rowIndex) => {
    const cells = Array.from(row.getElementsByTagName('w:tc'))
    const item = items[rowIndex]
    const values = item ? [rowIndex + 1, item.productName, item.sku || '', item.unit || '', item.quantity, ''] : ['', '', '', '', '', '']
    cells.forEach((cell, cellIndex) => setCellText(document, cell, values[cellIndex], templateParagraph))
  })
}

const updateDocumentXml = (xml, order) => {
  const parser = new DOMParser()
  const document = parser.parseFromString(xml, 'application/xml')
  const paragraphs = Array.from(document.getElementsByTagName('w:p'))
  const numberParagraph = paragraphs.find(item => textContent(item).includes('Số:'))
  if (numberParagraph) {
    const suffix = isReceiptOrder(order) ? 'PBGVT-KSQT' : 'PCVT-KSQT'
    const replacement = createTextParagraph(document, numberParagraph, `Số: ${order.orderNumber}/${suffix} — ${dateLong(order.date)}`)
    numberParagraph.parentNode.replaceChild(replacement, numberParagraph)
  }
  replaceParagraph(document, value => value.includes('Đơn vị nhận vật tư'), `- Đơn vị nhận vật tư: ${order.customerName || order.partnerName || ''}`)
  replaceParagraph(document, value => value.includes('Căn cứ giao nhận'), `- Căn cứ giao nhận: ${order.notes || ''}`)
  replaceParagraph(document, value => value.includes('PHIẾU BÀN GIAO VẬT TƯ') || value.includes('PHIẾU CẤP VẬT TƯ'), formTitleFor(order))
  const tables = Array.from(document.getElementsByTagName('w:tbl'))
  if (tables[1]) fillItemsTable(document, tables[1], order.items || [])
  return new XMLSerializer().serializeToString(document)
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportOrderDocx(order) {
  const response = await fetch(templateFor(order))
  if (!response.ok) throw new Error('Không tải được file biểu mẫu.')
  const zip = await JSZip.loadAsync(await response.arrayBuffer())
  const xml = await zip.file('word/document.xml').async('text')
  zip.file('word/document.xml', updateDocumentXml(xml, order))
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const suffix = isReceiptOrder(order) ? 'phieu-ban-giao-vat-tu' : 'phieu-cap-vat-tu'
  downloadBlob(blob, `${safeFilename(order.orderNumber)}-${suffix}.docx`)
}

export function printOrder(order) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!printWindow) throw new Error('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup cho trang này.')
  const rows = (order.items || []).map((item, index) => `<tr><td>${index + 1}</td><td>${htmlEscape(item.productName)}</td><td>${htmlEscape(item.sku || '')}</td><td>${htmlEscape(item.unit || '')}</td><td>${htmlEscape(item.quantity)}</td><td></td></tr>`).join('')
  const title = formTitleFor(order)
  const receiver = htmlEscape(order.customerName || order.partnerName || '')
  const notes = htmlEscape(order.notes || '')
  printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${htmlEscape(order.orderNumber)} - ${title}</title><style>
    @page{size:A4;margin:18mm 16mm}*{box-sizing:border-box}body{font-family:"Times New Roman",serif;color:#000;font-size:13px;margin:0}header{display:grid;grid-template-columns:1fr 1fr;text-align:center;font-weight:700;line-height:1.35}header .right{border-bottom:0}header .right em{font-weight:400;display:block} .number{margin-top:16px;font-style:italic}.title{text-align:center;font-size:18px;font-weight:700;margin:12px 0 18px}.meta{line-height:1.7;margin-bottom:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:6px 5px;min-height:25px}th{font-weight:700;text-align:center}td{text-align:center}td:nth-child(2){text-align:left;width:30%}th:nth-child(1),td:nth-child(1){width:7%}th:nth-child(2){width:30%}th:nth-child(3){width:13%}th:nth-child(4){width:10%}th:nth-child(5){width:12%}th:nth-child(6){width:28%}.signatures{display:grid;grid-template-columns:repeat(4,1fr);text-align:center;margin-top:24px;font-weight:700;min-height:110px}.signatures span{display:block;font-weight:400;margin-top:64px}.footer{margin-top:20px;text-align:center;font-size:11px} </style></head><body><header><div>CÔNG TY CỔ PHẦN<br>KHOÁNG SẢN QUẢNG TRỊ</div><div>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br><em>Độc lập – Tự do – Hạnh phúc</em></div></header><div class="number">Số: ${htmlEscape(order.orderNumber)}/${isReceiptOrder(order) ? 'PBGVT-KSQT' : 'PCVT-KSQT'} — ${dateLong(order.date)}</div><div class="title">${title}</div><div class="meta">- Đơn vị nhận vật tư: ${receiver}<br>- Người nhận:<br>- Căn cứ giao nhận: ${notes}</div><table><thead><tr><th>STT</th><th>Tên vật tư</th><th>Mã số</th><th>ĐVT</th><th>Số lượng</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table><div class="signatures"><div>${isReceiptOrder(order) ? 'BÊN NHẬN VẬT TƯ' : 'NGƯỜI LẬP'}<span></span></div><div>${isReceiptOrder(order) ? 'BÊN GIAO VẬT TƯ' : 'PHÒNG KH-KT'}<span></span></div><div>${isReceiptOrder(order) ? 'Người lập' : 'GIÁM ĐỐC'}<span></span></div><div>${isReceiptOrder(order) ? 'Phòng KH-KT' : ''}<span></span></div></div><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`)
  printWindow.document.close()
}
