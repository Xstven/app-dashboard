import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'

const COLORES = ['#5865f2', '#eb459e', '#3ba55d', '#faa61a', '#ed4245', '#9b59b6', '#1abc9c']
const colorDe = (txt = '') =>
  COLORES[[...txt].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length]
const iniciales = (txt = '') =>
  txt.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
const EMOJIS = ['😀', '😂', '😍', '😎', '🤔', '😭', '👍', '🔥', '🎉', '❤️', '👀', '🙏', '💀', '✨', '😅', '🤝']

function Avatar({ perfil, pequeno, punto }) {
  const nombre = perfil?.username ?? '?'
  return (
    <div className={`dc-av ${pequeno ? 'sm' : ''}`}>
      {perfil?.avatar_url ? (
        <img src={perfil.avatar_url} alt="" className="dc-avatar" />
      ) : (
        <div className="dc-avatar" style={{ background: colorDe(nombre) }}>
          {nombre[0]?.toUpperCase()}
        </div>
      )}
      {punto && <span className={`dc-dot ${punto === 'off' ? 'off' : ''}`} />}
    </div>
  )
}

function Chat() {
  const [yo, setYo] = useState(null)
  const [servidores, setServidores] = useState([])
  const [servidor, setServidor] = useState(null)
  const [canales, setCanales] = useState([])
  const [canal, setCanal] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [perfiles, setPerfiles] = useState({})
  const [miembros, setMiembros] = useState([])
  const [enLinea, setEnLinea] = useState([])
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [menu, setMenu] = useState(false)
  const [verMiembros, setVerMiembros] = useState(() => window.innerWidth > 900)
  const [emojis, setEmojis] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const conocidos = useRef(new Set())
  const fondo = useRef(null)
  const navigate = useNavigate()
  const { state } = useLocation()

  const traerPerfiles = async (ids) => {
    const faltan = [...new Set(ids)].filter((id) => id && !conocidos.current.has(id))
    if (faltan.length === 0) return
    faltan.forEach((id) => conocidos.current.add(id))
    const { data } = await supabase
      .from('profiles').select('id, username, avatar_url, rol').in('id', faltan)
    if (data) {
      setPerfiles((prev) => {
        const nuevo = { ...prev }
        data.forEach((p) => { nuevo[p.id] = p })
        return nuevo
      })
    }
  }

  useEffect(() => {
    async function iniciar() {
      const { data: { user } } = await supabase.auth.getUser()
      setYo(user)
      traerPerfiles([user.id])
      const { data: s } = await supabase.from('servers').select('*').order('id')
      if (!s || s.length === 0) { navigate('/servidores'); return }
      setServidores(s)
      setServidor(s.find((x) => x.id === state?.servidorId) ?? s[0])
    }
    iniciar()
  }, [])

  useEffect(() => {
    if (!servidor) return
    async function cargar() {
      const { data: chs } = await supabase
        .from('channels').select('*').eq('server_id', servidor.id).order('id')
      setCanales(chs ?? [])
      setCanal(chs?.[0] ?? null)
      if (!chs || chs.length === 0) setMensajes([])

      const { data: ms } = await supabase
        .from('server_members').select('user_id').eq('server_id', servidor.id)
      const ids = (ms ?? []).map((m) => m.user_id)
      setMiembros(ids)
      traerPerfiles(ids)
    }
    cargar()
  }, [servidor])

  useEffect(() => {
    if (!servidor || !yo) return
    const sala = supabase.channel(`presencia-${servidor.id}`, {
      config: { presence: { key: yo.id } },
    })
    sala
      .on('presence', { event: 'sync' }, () => {
        setEnLinea(Object.keys(sala.presenceState()))
      })
      .subscribe(async (estado) => {
        if (estado === 'SUBSCRIBED') await sala.track({ en_linea: true })
      })
    return () => { supabase.removeChannel(sala) }
  }, [servidor, yo])

  useEffect(() => {
    if (!canal) return
    let activo = true
    setMensajes([])
    setBusqueda('')

    async function cargar() {
      const { data } = await supabase
        .from('messages').select('*')
        .eq('channel_id', canal.id).order('created_at')
      if (!activo) return
      setMensajes(data ?? [])
      traerPerfiles((data ?? []).map((m) => m.user_id))
    }
    cargar()

    const suscripcion = supabase
      .channel(`canal-${canal.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `channel_id=eq.${canal.id}` },
        (payload) => {
          setMensajes((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new])
          traerPerfiles([payload.new.user_id])
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) =>
          setMensajes((prev) => prev.filter((m) => m.id !== payload.old.id)))
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(suscripcion)
    }
  }, [canal])

  useEffect(() => {
    if (!busqueda) fondo.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const miPerfil = perfiles[yo?.id]
  const soyAdmin = miPerfil?.rol === 'admin'

  const enviar = async (e) => {
    e.preventDefault()
    if (!texto.trim() || !canal) return
    const { data, error } = await supabase.from('messages')
      .insert({ content: texto.trim(), channel_id: canal.id, user_id: yo.id })
      .select().single()
    if (!error) {
      setMensajes((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data])
      setTexto('')
      setEmojis(false)
    }
  }

  const borrar = async (id) => {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (!error) setMensajes((prev) => prev.filter((m) => m.id !== id))
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const copiarCodigo = async () => {
    await navigator.clipboard.writeText(servidor.invite_code)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  const elegirCanal = (c) => { setCanal(c); setMenu(false) }

  const hora = (f) =>
    new Date(f).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dia = (f) =>
    new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

  const visibles = busqueda.trim()
    ? mensajes.filter((m) => m.content.toLowerCase().includes(busqueda.toLowerCase()))
    : mensajes

  const conectados = miembros.filter((id) => enLinea.includes(id))
  const desconectados = miembros.filter((id) => !enLinea.includes(id))

  const Miembro = ({ id, off }) => (
    <div className={`dc-miembro ${off ? 'off' : ''}`}>
      <Avatar perfil={perfiles[id]} pequeno punto={off ? 'off' : 'on'} />
      <span>{perfiles[id]?.username ?? '...'}</span>
      {perfiles[id]?.rol === 'admin' && <span className="dc-tag">ADMIN</span>}
    </div>
  )

  if (!servidor) return <div className="dc-carga">Cargando...</div>

  return (
    <div className="dc">
      {menu && <div className="dc-fondo" onClick={() => setMenu(false)} />}

      <div className={`dc-nav ${menu ? 'abierto' : ''}`}>
        <div className="dc-rail">
          <button className="dc-srv logo" title="Discord MVP">🎮</button>
          <div className="dc-sep" />
          {servidores.map((s) => (
            <button key={s.id} title={s.name}
              className={`dc-srv ${servidor.id === s.id ? 'on' : ''}`}
              onClick={() => setServidor(s)}>
              {iniciales(s.name)}
            </button>
          ))}
          <button className="dc-srv add" title="Crear o unirme a un servidor"
            onClick={() => navigate('/servidores')}>+</button>
          {soyAdmin && (
            <button className="dc-srv" title="Dashboard"
              onClick={() => navigate('/dashboard')}>🛠</button>
          )}
        </div>

        <div className="dc-side">
          <div className="dc-side-head"><span>{servidor.name}</span></div>
          <div className="dc-canales">
            <div className="dc-label" style={{ paddingTop: 8 }}>Canales de texto</div>
            {canales.map((c) => (
              <button key={c.id}
                className={`dc-canal ${canal?.id === c.id ? 'on' : ''}`}
                onClick={() => elegirCanal(c)}>
                <span className="h">#</span> {c.name}
              </button>
            ))}
            <div className="dc-label">Invita a tus amigos</div>
            <div className="dc-invita">
              <code>{servidor.invite_code}</code>
              <button onClick={copiarCodigo}>{copiado ? '¡Copiado!' : 'Copiar'}</button>
            </div>
          </div>
          <div className="dc-user">
            <Avatar perfil={miPerfil} pequeno punto="on" />
            <div className="info">
              <div className="nombre">{miPerfil?.username ?? '...'}</div>
              <div className="estado">En línea</div>
            </div>
            <button className="dc-icon" title="Mi perfil" onClick={() => navigate('/perfil')}>👤</button>
            <button className="dc-icon" title="Cerrar sesión" onClick={cerrarSesion}>🚪</button>
          </div>
        </div>
      </div>

      <div className="dc-main">
        <div className="dc-head">
          <button className="dc-icon dc-burger" onClick={() => setMenu(true)}>☰</button>
          <span className="hash">#</span>
          {canal?.name}
          <span className="espacio" />
          <input className="dc-buscar" placeholder="Buscar" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} />
          <button className="dc-icon" title="Lista de miembros"
            onClick={() => setVerMiembros(!verMiembros)}>👥</button>
        </div>

        <div className="dc-body">
          <div className="dc-chat">
            <div className="dc-msgs">
              {canal && !busqueda && (
                <div className="dc-inicio">
                  <div className="gran">#</div>
                  <h3>Te damos la bienvenida a #{canal.name}</h3>
                  <p>Este es el comienzo del canal #{canal.name}.</p>
                </div>
              )}
              {busqueda && visibles.length === 0 && (
                <div className="dc-vacio">No se encontraron mensajes.</div>
              )}
              {visibles.map((m, i) => {
                const prev = visibles[i - 1]
                const otroDia = !prev || dia(prev.created_at) !== dia(m.created_at)
                const junto = !otroDia && prev.user_id === m.user_id &&
                  new Date(m.created_at) - new Date(prev.created_at) < 7 * 60 * 1000
                const p = perfiles[m.user_id]
                const puedeBorrar = m.user_id === yo?.id || soyAdmin
                const mencion = miPerfil?.username &&
                  m.content.toLowerCase().includes(`@${miPerfil.username.toLowerCase()}`)
                return (
                  <div key={m.id}>
                    {otroDia && <div className="dc-dia">{dia(m.created_at)}</div>}
                    <div className={`dc-msg ${junto ? 'junto' : ''} ${mencion ? 'mencion' : ''}`}
                      style={otroDia ? { marginTop: 8 } : undefined}>
                      {junto ? (
                        <div className="dc-hueco">{hora(m.created_at)}</div>
                      ) : (
                        <Avatar perfil={p} />
                      )}
                      <div className="dc-cuerpo">
                        {!junto && (
                          <div>
                            <span className={`dc-nombre ${p?.rol === 'admin' ? 'admin' : ''}`}>
                              {p?.username ?? '...'}
                            </span>
                            {p?.rol === 'admin' && <span className="dc-tag">ADMIN</span>}
                            <span className="dc-hora">{hora(m.created_at)}</span>
                          </div>
                        )}
                        <div className="dc-texto">{m.content}</div>
                      </div>
                      {puedeBorrar && (
                        <button className="dc-borrar" title="Borrar mensaje"
                          onClick={() => borrar(m.id)}>🗑</button>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={fondo} />
            </div>

            <form className="dc-form" onSubmit={enviar}>
              <div className="dc-input">
                <span className="mas">＋</span>
                <input placeholder={`Enviar mensaje a #${canal?.name ?? ''}`}
                  value={texto} onChange={(e) => setTexto(e.target.value)} />
                <button type="button" className="dc-icon" title="Emojis"
                  onClick={() => setEmojis(!emojis)}>😀</button>
                {emojis && (
                  <div className="dc-emojis">
                    {EMOJIS.map((em) => (
                      <button type="button" key={em} onClick={() => setTexto(texto + em)}>{em}</button>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className={`dc-miembros ${verMiembros ? '' : 'oculto'}`}>
            <div className="dc-label" style={{ paddingTop: 8 }}>En línea — {conectados.length}</div>
            {conectados.map((id) => <Miembro key={id} id={id} />)}
            {desconectados.length > 0 && (
              <>
                <div className="dc-label">Desconectados — {desconectados.length}</div>
                {desconectados.map((id) => <Miembro key={id} id={id} off />)}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chat