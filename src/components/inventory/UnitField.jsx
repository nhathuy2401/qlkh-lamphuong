const UNIT_OPTIONS = ['cái', 'bộ', 'kg', 'tấn', 'm', 'm²', 'm³', 'lít', 'hộp', 'thùng', 'cuộn', 'đôi', 'chiếc']

export function UnitField({ value, onChange }) {
  const isPreset = UNIT_OPTIONS.includes(value)
  const selectValue = isPreset ? value : 'custom'
  return <div className="unit-field">
    <select value={selectValue} onChange={event => onChange(event.target.value === 'custom' ? '' : event.target.value)}>
      {UNIT_OPTIONS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
      <option value="custom">Tùy chỉnh...</option>
    </select>
    {!isPreset && <input required value={value} onChange={event => onChange(event.target.value)} placeholder="Nhập đơn vị tính" />}
  </div>
}
