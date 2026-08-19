import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { PageHeader } from '../ui/PageHeader'
import { Icon } from '../ui/Icon'

export const Organization = observer(({ store }) => {
  const { data } = store
  const [business, setBusiness] = useState('')
  const [facility, setFacility] = useState('')
  const [businessId, setBusinessId] = useState(data.businesses[0]?.id || '')
  const addBusiness = (event) => { event.preventDefault(); if (!business.trim()) return; store.addBusiness(business); setBusiness('') }
  const addFacility = (event) => { event.preventDefault(); if (!facility.trim() || !businessId) return; store.addFacility(businessId, facility); setFacility('') }
  return <><PageHeader eyebrow="CẤU HÌNH" title="Doanh nghiệp & đơn vị" description="Danh mục mở — bạn có thể thêm mới, không bị khóa vào dữ liệu mẫu." /><div className="two-col"><section className="panel"><div className="panel-heading"><div><h3>Doanh nghiệp</h3><span>{data.businesses.length} doanh nghiệp</span></div></div><form className="inline-form" onSubmit={addBusiness}><input value={business} onChange={e => setBusiness(e.target.value)} placeholder="Tên doanh nghiệp mới" /><button className="button primary"><Icon name="plus" /></button></form><div className="simple-list">{data.businesses.map(item => <div className="simple-row" key={item.id}><span className="product-symbol">D</span><b>{item.name}</b></div>)}</div></section><section className="panel"><div className="panel-heading"><div><h3>Nhà máy / chi nhánh</h3><span>{data.facilities.length} đơn vị</span></div></div><form className="stack" onSubmit={addFacility}><select value={businessId} onChange={e => setBusinessId(e.target.value)}>{data.businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="inline-form"><input value={facility} onChange={e => setFacility(e.target.value)} placeholder="Tên đơn vị mới" /><button className="button primary"><Icon name="plus" /></button></div></form><div className="simple-list">{data.facilities.map(item => <div className="simple-row" key={item.id}><span className="product-symbol">N</span><div><b>{item.name}</b><small>{data.businesses.find(businessItem => businessItem.id === item.businessId)?.name || '—'}</small></div></div>)}</div></section></div></>
})
