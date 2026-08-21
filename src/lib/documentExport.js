import JSZip from 'jszip'

const RECEIPT_CUSTOMERS = new Set([
  'Xí nghiệp khai thác khoáng sản',
  'Xí nghiệp khai thác khoáng sản - Vĩnh Tú',
  'Xí nghiệp khai thác khoáng sản - Vĩnh Thái',
])

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const MAX_PRINT_ROWS = 15

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
  return paragraph
}

const setParagraphAlignment = (document, paragraph, alignment) => {
  if (!paragraph) return
  let properties = paragraph.getElementsByTagName('w:pPr')[0]
  if (!properties) {
    properties = document.createElementNS(WORD_NS, 'w:pPr')
    paragraph.insertBefore(properties, paragraph.firstChild)
  }
  let justification = properties.getElementsByTagName('w:jc')[0]
  if (!justification) {
    justification = document.createElementNS(WORD_NS, 'w:jc')
    properties.appendChild(justification)
  }
  justification.setAttribute('w:val', alignment)
}

const setCellVerticalAlignment = (document, cell) => {
  const properties = cell.getElementsByTagName('w:tcPr')[0]
  if (!properties) return
  let alignment = properties.getElementsByTagName('w:vAlign')[0]
  if (!alignment) {
    alignment = document.createElementNS(WORD_NS, 'w:vAlign')
    properties.appendChild(alignment)
  }
  alignment.setAttribute('w:val', 'center')
}

const setTableWidth = (table, width) => {
  const properties = table.getElementsByTagName('w:tblPr')[0]
  const tableWidth = properties?.getElementsByTagName('w:tblW')[0]
  if (!tableWidth) return
  tableWidth.setAttribute('w:w', width)
  tableWidth.setAttribute('w:type', 'dxa')
}

const createSignatureCell = (document, sourceCell, sourceParagraph, width, title, subtitle) => {
  const cell = sourceCell.cloneNode(false)
  const properties = sourceCell.getElementsByTagName('w:tcPr')[0]
  if (properties) {
    const clonedProperties = properties.cloneNode(true)
    const cellWidth = clonedProperties.getElementsByTagName('w:tcW')[0]
    if (cellWidth) {
      cellWidth.setAttribute('w:w', width)
      cellWidth.setAttribute('w:type', 'dxa')
    }
    cell.appendChild(clonedProperties)
  }
  setCellVerticalAlignment(document, cell)
  cell.appendChild(createSignatureParagraph(document, sourceParagraph, title))
  if (subtitle) cell.appendChild(createSignatureParagraph(document, sourceParagraph, subtitle))
  return cell
}

const createSignatureParagraph = (document, sourceParagraph, value) => {
  const paragraph = createTextParagraph(document, sourceParagraph, value)
  setParagraphAlignment(document, paragraph, 'center')
  return paragraph
}

const alignReceiptSignatures = (document, table) => {
  const rows = Array.from(table.getElementsByTagName('w:tr'))
  const sourceCell = rows[0]?.getElementsByTagName('w:tc')[0]
  const sourceParagraph = sourceCell?.getElementsByTagName('w:p')[0]
  if (!sourceCell || !sourceParagraph) return

  setTableWidth(table, '10357')
  const grid = table.getElementsByTagName('w:tblGrid')[0]
  if (grid) {
    Array.from(grid.childNodes).forEach(child => grid.removeChild(child))
    ;['3452', '3452', '3453'].forEach(width => {
      const column = document.createElementNS(WORD_NS, 'w:gridCol')
      column.setAttribute('w:w', width)
      grid.appendChild(column)
    })
  }

  rows.forEach(row => row.parentNode.removeChild(row))
  const row = document.createElementNS(WORD_NS, 'w:tr')
  ;[
    ['BÊN NHẬN VẬT TƯ', 'Người lập'],
    ['BÊN GIAO VẬT TƯ', 'Phòng KH-KT'],
    ['DUYỆT', ''],
  ].forEach(([title, subtitle], index) => {
    row.appendChild(createSignatureCell(document, sourceCell, sourceParagraph, ['3452', '3452', '3453'][index], title, subtitle))
  })
  table.appendChild(row)
}

const fillItemsTable = (document, table, items) => {
  const printableItems = (items || []).slice(0, MAX_PRINT_ROWS)
  let rows = Array.from(table.getElementsByTagName('w:tr'))
  const templateRow = rows[1] || rows[0]
  while (rows.length - 1 < printableItems.length) {
    const extraRow = templateRow.cloneNode(true)
    table.appendChild(extraRow)
    rows = Array.from(table.getElementsByTagName('w:tr'))
  }
  rows.slice(MAX_PRINT_ROWS + 1).forEach(row => row.parentNode.removeChild(row))
  rows = Array.from(table.getElementsByTagName('w:tr'))

  // Keep each column's own paragraph formatting. Reusing the STT paragraph
  // for every cell makes Word fall back to the wrong alignment after export.
  rows.forEach((row, rowIndex) => {
    Array.from(row.getElementsByTagName('w:tc')).forEach((cell, cellIndex) => {
      setCellVerticalAlignment(document, cell)
      const paragraph = cell.getElementsByTagName('w:p')[0]
      setParagraphAlignment(document, paragraph, rowIndex === 0 || cellIndex !== 1 ? 'center' : 'left')
    })
  })

  rows.slice(1).forEach((row, rowIndex) => {
    const cells = Array.from(row.getElementsByTagName('w:tc'))
    const item = printableItems[rowIndex]
    const values = item ? [rowIndex + 1, item.productName, item.sku || '', item.unit || '', item.quantity, ''] : ['', '', '', '', '', '']
    cells.forEach((cell, cellIndex) => {
      const sourceParagraph = cell.getElementsByTagName('w:p')[0]
      const paragraph = setCellText(document, cell, values[cellIndex], sourceParagraph)
      setParagraphAlignment(document, paragraph, cellIndex === 1 ? 'left' : 'center')
    })
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
  if (tables[2] && isReceiptOrder(order)) alignReceiptSignatures(document, tables[2])
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

export async function createOrderDocxBlob(order) {
  const response = await fetch(templateFor(order))
  if (!response.ok) throw new Error('Không tải được file biểu mẫu.')
  const zip = await JSZip.loadAsync(await response.arrayBuffer())
  const xml = await zip.file('word/document.xml').async('text')
  zip.file('word/document.xml', updateDocumentXml(xml, order))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

export async function exportOrderDocx(order) {
  const blob = await createOrderDocxBlob(order)
  const suffix = isReceiptOrder(order) ? 'phieu-ban-giao-vat-tu' : 'phieu-cap-vat-tu'
  downloadBlob(blob, `${safeFilename(order.orderNumber)}-${suffix}.docx`)
}

const folderDate = value => {
  const [year, month, day] = String(value || '').split('-')
  return [day, month, year].filter(Boolean).join('-') || 'khong-ngay'
}

export async function exportAllOrdersDocx(orders, type) {
  if (!orders.length) throw new Error('Không có hóa đơn nào để tải xuống.')
  const archive = new JSZip()
  for (const order of orders) {
    const blob = await createOrderDocxBlob(order)
    const suffix = isReceiptOrder(order) ? 'phieu-ban-giao-vat-tu' : 'phieu-cap-vat-tu'
    archive.file(`${folderDate(order.date)}---hoa-don/${safeFilename(order.orderNumber)}-${suffix}.docx`, blob)
  }
  const archiveBlob = await archive.generateAsync({ type: 'blob', mimeType: 'application/zip' })
  const label = type === 'Outbound' ? 'phieu-xuat-kho' : 'phieu-nhap-kho'
  downloadBlob(archiveBlob, `${label}---${folderDate(new Date().toISOString().slice(0, 10))}.zip`)
}

export function printOrder(order) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup cho trang này.')
  const printableItems = (order.items || []).slice(0, MAX_PRINT_ROWS)
  const rows = Array.from({ length: MAX_PRINT_ROWS }, (_, index) => {
    const item = printableItems[index]
    return item ? `<tr><td>${index + 1}</td><td>${htmlEscape(item.productName)}</td><td>${htmlEscape(item.sku || '')}</td><td>${htmlEscape(item.unit || '')}</td><td>${htmlEscape(item.quantity)}</td><td></td></tr>` : '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
  }).join('')
  const title = formTitleFor(order)
  const receiver = htmlEscape(order.customerName || order.partnerName || '')
  const notes = htmlEscape(order.notes || '')
  printWindow.document.open()
  printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${htmlEscape(order.orderNumber)} - ${title}</title><style>
    @page{size:A4;margin:15mm 14mm}*{box-sizing:border-box}body{font-family:"Times New Roman",serif;color:#000;font-size:11px;margin:0}header{display:grid;grid-template-columns:1fr 1fr;text-align:center;font-weight:700;line-height:1.25}header .right{border-bottom:0}header .right em{font-weight:400;display:block}.number{margin-top:10px;font-style:italic}.title{text-align:center;font-size:16px;font-weight:700;margin:8px 0 12px}.meta{line-height:1.45;margin-bottom:8px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:3px 4px;height:20px;vertical-align:middle}th{font-weight:700;text-align:center}td{text-align:center}td:nth-child(2){text-align:left;width:30%}th:nth-child(1),td:nth-child(1){width:7%}th:nth-child(2){width:30%}th:nth-child(3){width:13%}th:nth-child(4){width:10%}th:nth-child(5){width:12%}th:nth-child(6){width:28%}.signatures{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;margin-top:16px;font-weight:700;min-height:85px}.signatures span{display:block;font-weight:700;margin-top:38px}.footer{margin-top:12px;text-align:center;font-size:10px} </style></head><body><header><div>CÔNG TY CỔ PHẦN<br>KHOÁNG SẢN QUẢNG TRỊ</div><div>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br><em>Độc lập – Tự do – Hạnh phúc</em></div></header><div class="number">Số: ${htmlEscape(order.orderNumber)}/${isReceiptOrder(order) ? 'PBGVT-KSQT' : 'PCVT-KSQT'} — ${dateLong(order.date)}</div><div class="title">${title}</div><div class="meta">- Đơn vị nhận vật tư: ${receiver}<br>- Người nhận:<br>- Căn cứ giao nhận: ${notes}</div><table><thead><tr><th>STT</th><th>Tên vật tư</th><th>Mã số</th><th>ĐVT</th><th>Số lượng</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table><div class="signatures"><div>${isReceiptOrder(order) ? 'BÊN NHẬN VẬT TƯ' : 'NGƯỜI LẬP'}${isReceiptOrder(order) ? '<span>Người lập</span>' : '<span></span>'}</div><div>${isReceiptOrder(order) ? 'BÊN GIAO VẬT TƯ' : 'PHÒNG KH-KT'}${isReceiptOrder(order) ? '<span>Phòng KH-KT</span>' : '<span></span>'}</div><div>${isReceiptOrder(order) ? 'DUYỆT' : 'GIÁM ĐỐC'}<span></span></div></div><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`)
  const logoStyle = printWindow.document.createElement('style')
  logoStyle.textContent = 'header>div:first-child::before{content:"";display:inline-block;width:24px;height:28px;margin-right:6px;vertical-align:middle;background:url("/assets/logo-qmc.jpeg") center/contain no-repeat}'
  printWindow.document.head.appendChild(logoStyle)
  printWindow.document.close()
}

export function printAllOrders(orders, type) {
  if (!orders.length) throw new Error('Không có hóa đơn nào để in.')
  const sheets = orders.map(order => {
    const printableItems = (order.items || []).slice(0, MAX_PRINT_ROWS)
    const rows = Array.from({ length: MAX_PRINT_ROWS }, (_, index) => {
      const item = printableItems[index]
      return item ? `<tr><td>${index + 1}</td><td>${htmlEscape(item.productName)}</td><td>${htmlEscape(item.sku || '')}</td><td>${htmlEscape(item.unit || '')}</td><td>${htmlEscape(item.quantity)}</td><td></td></tr>` : '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
    }).join('')
    const title = formTitleFor(order)
    return `<section class="order-sheet"><header><div>CÔNG TY CỔ PHẦN<br>KHOÁNG SẢN QUẢNG TRỊ</div><div>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br><em>Độc lập – Tự do – Hạnh phúc</em></div></header><div class="number">Số: ${htmlEscape(order.orderNumber)}/${isReceiptOrder(order) ? 'PBGVT-KSQT' : 'PCVT-KSQT'} — ${dateLong(order.date)}</div><div class="title">${title}</div><div class="meta">- Đơn vị nhận vật tư: ${htmlEscape(order.customerName || order.partnerName || '')}<br>- Người nhận:<br>- Căn cứ giao nhận: ${htmlEscape(order.notes || '')}</div><table><thead><tr><th>STT</th><th>Tên vật tư</th><th>Mã số</th><th>ĐVT</th><th>Số lượng</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table><div class="signatures"><div>${isReceiptOrder(order) ? 'BÊN NHẬN VẬT TƯ' : 'NGƯỜI LẬP'}<span></span></div><div>${isReceiptOrder(order) ? 'BÊN GIAO VẬT TƯ' : 'PHÒNG KH-KT'}<span></span></div><div>${isReceiptOrder(order) ? 'DUYỆT' : 'GIÁM ĐỐC'}<span></span></div></div></section>`
  }).join('')
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup cho trang này.')
  const label = type === 'Outbound' ? 'phiếu xuất kho' : 'phiếu nhập kho'
  printWindow.document.open()
  printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>In tất cả ${label}</title><style>@page{size:A4;margin:15mm 14mm}*{box-sizing:border-box}body{font-family:"Times New Roman",serif;color:#000;font-size:11px;margin:0}.order-sheet{page-break-after:always}.order-sheet:last-child{page-break-after:auto}header{display:grid;grid-template-columns:1fr 1fr;text-align:center;font-weight:700;line-height:1.25}header em{font-weight:400}.number{margin-top:10px;font-style:italic}.title{text-align:center;font-size:16px;font-weight:700;margin:8px 0 12px}.meta{line-height:1.45;margin-bottom:8px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:3px 4px;height:20px;vertical-align:middle}th{font-weight:700;text-align:center}td{text-align:center}td:nth-child(2){text-align:left;width:30%}th:nth-child(1),td:nth-child(1){width:7%}th:nth-child(2){width:30%}th:nth-child(3){width:13%}th:nth-child(4){width:10%}th:nth-child(5){width:12%}th:nth-child(6){width:28%}.signatures{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;margin-top:16px;font-weight:700;min-height:85px}.signatures span{display:block;margin-top:38px}</style></head><body>${sheets}<script>window.onload=()=>{window.focus();window.print()}</script></body></html>`)
  printWindow.document.close()
}
