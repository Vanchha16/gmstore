import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  adminGetProduct, adminCreateProduct, adminUpdateProduct,
  adminListCategories, adminUploadImage, adminDeleteImage,
} from '../../api/endpoints'
import AdminLayout from './AdminLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

const STATUS_OPTIONS = ['draft', 'coming_soon', 'active', 'archived']
const TYPE_OPTIONS = ['account', 'game_key']

export default function ProductForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState({
    title: '', description: '', product_type: 'game_key', category_id: '',
    price: '', compare_at_price: '', currency: 'USD', status: 'draft',
    release_date: '', is_featured: false, delivery_time: '', rules: '',
  })
  const [categories, setCategories] = useState([])
  const [images, setImages] = useState([])
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    adminListCategories().then(({ data }) => setCategories(data))
    if (isEdit) {
      adminGetProduct(id).then(({ data }) => {
        setForm({
          title: data.title || '',
          description: data.description || '',
          product_type: data.product_type || 'game_key',
          category_id: data.category?.id || '',
          price: data.price || '',
          compare_at_price: data.compare_at_price || '',
          currency: data.currency || 'USD',
          status: data.status || 'draft',
          release_date: data.release_date ? data.release_date.slice(0, 16) : '',
          is_featured: data.is_featured || false,
          delivery_time: data.delivery_time || '',
          rules: data.rules || '',
        })
        setImages(data.images || [])
      })
    }
  }, [id])

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required.'
    if (!form.price || isNaN(Number(form.price))) e.price = 'Valid price required.'
    return e
  }

  const submit = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    setErrors({})
    setApiError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
        category_id: form.category_id ? Number(form.category_id) : null,
        release_date: form.release_date || null,
      }
      if (isEdit) {
        await adminUpdateProduct(id, payload)
      } else {
        await adminCreateProduct(payload)
      }
      navigate('/admin/products')
    } catch (err) {
      setApiError(err.response?.data?.error || 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !isEdit) return
    setUploading(true)
    try {
      const { data } = await adminUploadImage(id, file)
      setImages((prev) => [...prev, data])
    } catch {
      setApiError('Image upload failed.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteImage = async (imgId) => {
    await adminDeleteImage(imgId)
    setImages((prev) => prev.filter((i) => i.id !== imgId))
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/admin/products" className="text-slate-400 hover:text-slate-200">← Catalog</Link>
        <h1 className="text-xl font-bold text-slate-100">{isEdit ? 'Edit Product' : 'Add New Product'}</h1>
      </div>

      {apiError && <p className="mb-4 rounded-xl bg-red-900/30 px-4 py-3 text-sm text-red-400">{apiError}</p>}

      <div className="grid gap-8 lg:grid-cols-3">
        <form onSubmit={submit} className="lg:col-span-2 space-y-5">
          <Input label="Title *" value={form.title} onChange={set('title')} error={errors.title} />
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={set('description')}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Type</label>
              <select value={form.product_type} onChange={set('product_type')}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500">
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Category</label>
              <select value={form.category_id} onChange={set('category_id')}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500">
                <option value="">— none —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Price *" type="number" step="0.01" min="0" value={form.price} onChange={set('price')} error={errors.price} />
            <Input label="Compare-at price" type="number" step="0.01" min="0" value={form.compare_at_price} onChange={set('compare_at_price')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Status</label>
              <select value={form.status} onChange={set('status')}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Input label="Release date" type="datetime-local" value={form.release_date} onChange={set('release_date')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_featured} onChange={set('is_featured')}
              className="rounded border-slate-600 bg-slate-800 text-violet-500" />
            <span className="text-sm text-slate-400">Mark as featured (Best Sale)</span>
          </label>

          <Input
            label="Delivery Time"
            value={form.delivery_time}
            onChange={set('delivery_time')}
            placeholder="e.g. 5–30 minutes, 1–24 hours"
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">Product Rules / Terms</label>
            <textarea
              rows={4}
              value={form.rules}
              onChange={set('rules')}
              placeholder="e.g. No refunds after delivery. Account must not be logged in on other devices..."
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500 resize-none"
            />
          </div>

          <Button type="submit" loading={loading} className="w-full">{isEdit ? 'Save changes' : 'Create product'}</Button>
        </form>

        {/* Images panel */}
        <div>
          <h2 className="mb-3 font-semibold text-slate-200">Images</h2>
          {!isEdit && <p className="text-xs text-slate-500 mb-3">Save the product first to upload images.</p>}
          {isEdit && (
            <>
              <label className="mb-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400 hover:border-violet-600 hover:text-violet-400 transition">
                <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} disabled={uploading} />
                {uploading ? 'Uploading…' : '+ Upload image'}
              </label>
              <div className="space-y-2">
                {images.map((img) => (
                  <div key={img.id} className="flex items-center gap-3 rounded-xl border border-slate-800 p-2">
                    <img src={img.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs text-slate-500">{img.url}</p>
                      {img.is_primary && <span className="text-xs text-violet-400">Primary</span>}
                    </div>
                    <button onClick={() => handleDeleteImage(img.id)} className="text-red-500 hover:text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
