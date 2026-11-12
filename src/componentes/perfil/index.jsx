import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const COLORES = ['#5865f2', '#eb459e', '#3ba55d', '#faa61a', '#ed4245', '#9b59b6', '#1abc9c']
const colorDe = (txt = '') =>
  COLORES[[...txt].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length]

function Perfil() {
  const [perfil, setPerfil] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [imgFalla, setImgFalla] = useState(false)
  const navigate = useNavigate()

  const mostrarAviso = (tipo, texto) => {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 2500)
  }

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setPerfil({ ...data, correo: user.email })
    }
    cargar()
  }, [])

  const handleChange = (e) => {
    if (e.target.name === 'avatar_url') setImgFalla(false)
    setPerfil({ ...perfil, [e.target.name]: e.target.value })
  }

  const guardar = async () => {
    const username = (perfil.username ?? '').trim()
    if (!username) return mostrarAviso('mal', 'El nombre de usuario no puede estar vacío')

    setGuardando(true)
    const { error } = await supabase.from('profiles')
      .update({ username, avatar_url: perfil.avatar_url?.trim() || null })
      .eq('id', perfil.id)
    setGuardando(false)

    if (error) mostrarAviso('mal', 'No se pudo guardar')
    else {
      setPerfil({ ...perfil, username })
      mostrarAviso('ok', 'Datos actualizados')
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (!perfil) return <p className="p-4">Cargando...</p>

  const color = colorDe(perfil.username ?? '')
  const hayImagen = perfil.avatar_url && !imgFalla

  const Avatar = () =>
    hayImagen ? (
      <img src={perfil.avatar_url} alt="" className="dc-avatar"
        onError={() => setImgFalla(true)} />
    ) : (
      <div className="dc-avatar" style={{ background: color }}>
        {(perfil.username ?? '?')[0]?.toUpperCase()}
      </div>
    )

  return (
    <div className="pf-bg">
      <div className="pf-card">
        <div className="pf-banner" style={{ background: color }} />
        <div className="pf-av"><Avatar /></div>

        <div className="pf-head">
          <div>
            <h2>
              {perfil.username}
              {perfil.rol === 'admin' && <span className="dc-tag">ADMIN</span>}
            </h2>
            <div className="text-secondary small">{perfil.correo}</div>
            <div className="pf-meta">
              {perfil.created_at && (
                <span className="pf-chip">
                  Miembro desde {new Date(perfil.created_at).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </span>
              )}
              <span className="pf-chip">{perfil.rol === 'admin' ? 'Administrador' : 'Usuario'}</span>
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/chat')}>Ir al chat</button>
            {perfil.rol === 'admin' && (
              <button className="btn btn-outline-primary btn-sm" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
            )}
            <button className="btn btn-outline-secondary btn-sm" onClick={cerrarSesion}>Cerrar sesión</button>
          </div>
        </div>

        <div className="pf-body row g-3">
          <div className="col-12">
            <p className="pf-seccion">Mi cuenta</p>
          </div>
          <div className="col-md-6">
            <label className="form-label">Nombre de usuario</label>
            <input className="form-control" name="username"
              value={perfil.username ?? ''} onChange={handleChange} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Correo</label>
            <input className="form-control" value={perfil.correo} disabled />
          </div>

          <div className="col-12">
            <label className="form-label">URL del avatar</label>
            <input className="form-control" name="avatar_url" placeholder="https://..."
              value={perfil.avatar_url ?? ''} onChange={handleChange} />
            {perfil.avatar_url && imgFalla ? (
              <div className="pf-ayuda text-danger">No se pudo cargar esa imagen. Revisa el enlace.</div>
            ) : (
              <div className="pf-ayuda">Pega el enlace de una imagen. Si lo dejas vacío, se usa tu inicial.</div>
            )}
          </div>

          <div className="col-12">
            <div className="pf-prev">
              <div className="dc-av"><Avatar /></div>
              <div className="txt">
                Así te verán en el chat
                <b>{perfil.username || '...'}</b>
              </div>
            </div>
          </div>

          <div className="col-12">
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {aviso && <div className={`pf-toast ${aviso.tipo}`}>{aviso.texto}</div>}
    </div>
  )
}

export default Perfil