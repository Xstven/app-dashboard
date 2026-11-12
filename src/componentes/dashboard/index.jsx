import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

const COLORES = ['#5865f2', '#eb459e', '#3ba55d', '#faa61a', '#ed4245', '#9b59b6', '#1abc9c']
const colorDe = (txt = '') =>
  COLORES[[...txt].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length]

function Dashboard() {
  const [perfiles, setPerfiles] = useState([])
  const [canales, setCanales] = useState([])
  const [recientes, setRecientes] = useState([])
  const [totales, setTotales] = useState({ servidores: 0, mensajes: 0 })
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const navigate = useNavigate()

  const mostrarAviso = (tipo, texto) => {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 2500)
  }

  // 1. Solo entra el admin
  useEffect(() => {
    async function verificarYCargar() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: yo } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (yo?.rol !== 'admin') {
        navigate('/perfil')
        return
      }
      await cargarDatos()
      setCargando(false)
    }
    verificarYCargar()
  }, [])

  // 2. Datos
  const cargarDatos = async () => {
    const { data: p } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setPerfiles(p ?? [])

    const { data: c } = await supabase.from('channels')
      .select('id, name, servers(name), messages(count)')
    setCanales(c ?? [])

    const { data: r } = await supabase.from('messages')
      .select('id, content, created_at, user_id, channels(name, servers(name))')
      .order('created_at', { ascending: false }).limit(8)
    setRecientes(r ?? [])

    const { count: s } = await supabase.from('servers').select('*', { count: 'exact', head: true })
    const { count: m } = await supabase.from('messages').select('*', { count: 'exact', head: true })
    setTotales({ servidores: s ?? 0, mensajes: m ?? 0 })
  }

  // 3. Indicadores
  const admins = perfiles.filter((u) => u.rol === 'admin').length
  const indicadores = [
    ['Usuarios', perfiles.length, '👥', '#5865f2'],
    ['Administradores', admins, '🛡️', '#f0b132'],
    ['Servidores', totales.servidores, '🎮', '#23a55a'],
    ['Mensajes', totales.mensajes, '💬', '#eb459e'],
  ]
  const conteo = (c) => c.messages?.[0]?.count ?? 0
  const maxMensajes = Math.max(1, ...canales.map(conteo))

  const filtrados = perfiles.filter((u) =>
    (u.username ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  // 4. Editar usuario (el rol no se toca desde la app)
  const cambiarNombre = (id, valor) =>
    setPerfiles(perfiles.map((u) => (u.id === id ? { ...u, username: valor } : u)))

  const guardar = async (u) => {
    const { error } = await supabase.from('profiles')
      .update({ username: u.username }).eq('id', u.id)
    if (error) mostrarAviso('mal', 'No se pudo guardar')
    else mostrarAviso('ok', `Guardado: ${u.username}`)
  }

  // 5. Borrar un mensaje (el admin puede borrar los de todos)
  const borrarMensaje = async (id) => {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) return mostrarAviso('mal', 'No se pudo borrar')
    mostrarAviso('ok', 'Mensaje borrado')
    cargarDatos()
  }

  const nombreDe = (id) => perfiles.find((u) => u.id === id)?.username ?? '...'

  const Avatar = ({ u }) =>
    u.avatar_url ? (
      <img src={u.avatar_url} alt="" className="db-av" />
    ) : (
      <div className="db-av" style={{ background: colorDe(u.username ?? '') }}>
        {(u.username ?? '?')[0].toUpperCase()}
      </div>
    )

  if (cargando) return <p className="p-4">Cargando...</p>

  return (
    <div className="db">
      {/* Encabezado */}
      <div className="db-head">
        <div>
          <h1>Dashboard</h1>
          <p>Resumen de tu plataforma</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={() => navigate('/chat')}>Ir al chat</button>
          <button className="btn btn-outline-secondary" onClick={() => navigate('/perfil')}>Mi perfil</button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="row g-3 mb-4">
        {indicadores.map(([titulo, valor, icono, color]) => (
          <div className="col-6 col-lg-3" key={titulo}>
            <div className="db-stat" style={{ '--acento': color }}>
              <div>
                <div className="tit">{titulo}</div>
                <div className="num">{valor}</div>
              </div>
              <div className="ico">{icono}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Gráfica de barras */}
      <div className="db-panel">
        <h2>Mensajes por canal</h2>
        <p className="sub">Cuántos mensajes tiene cada canal</p>
        {canales.length === 0 && <div className="db-vacio">Aún no hay canales.</div>}
        {canales.map((c) => (
          <div className="db-bar" key={c.id}>
            <span className="nom" title={`${c.name} · ${c.servers?.name ?? ''}`}>
              # {c.name} · {c.servers?.name}
            </span>
            <div className="progress">
              <div className="progress-bar"
                style={{ width: `${(conteo(c) / maxMensajes) * 100}%` }}>
                {conteo(c)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mensajes recientes */}
      <div className="db-panel">
        <h2>Mensajes recientes</h2>
        <p className="sub">Los últimos 8. Puedes borrar los que quieras.</p>
        <div className="table-responsive">
          <table className="table db-table align-middle mb-0">
            <thead>
              <tr><th>Usuario</th><th>Canal</th><th>Mensaje</th><th></th></tr>
            </thead>
            <tbody>
              {recientes.map((m) => (
                <tr key={m.id}>
                  <td>{nombreDe(m.user_id)}</td>
                  <td># {m.channels?.name} · {m.channels?.servers?.name}</td>
                  <td><div className="db-msg">{m.content}</div></td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-danger"
                      onClick={() => borrarMensaje(m.id)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recientes.length === 0 && <div className="db-vacio">Todavía no hay mensajes.</div>}
        </div>
      </div>

      {/* Usuarios */}
      <div className="db-panel">
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-2">
          <div>
            <h2>Usuarios</h2>
            <p className="sub mb-0">Edita el nombre y pulsa Guardar</p>
          </div>
          <input className="form-control w-auto" placeholder="Buscar por usuario"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div className="table-responsive">
          <table className="table db-table table-hover align-middle mb-0">
            <thead>
              <tr><th>Usuario</th><th>Rol</th><th>Creado</th><th></th></tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="db-user">
                      <Avatar u={u} />
                      <input className="form-control form-control-sm" value={u.username ?? ''}
                        onChange={(e) => cambiarNombre(u.id, e.target.value)} />
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${u.rol === 'admin' ? 'text-bg-warning' : 'text-bg-primary'}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString('es-CO')}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-primary" onClick={() => guardar(u)}>Guardar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && <div className="db-vacio">No se encontraron usuarios.</div>}
        </div>
      </div>

      {aviso && <div className={`db-toast ${aviso.tipo}`}>{aviso.texto}</div>}
    </div>
  )
}

export default Dashboard