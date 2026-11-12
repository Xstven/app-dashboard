import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

function Servidores() {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [mensaje, setMensaje] = useState(null)
  const navigate = useNavigate()

  const crear = async (e) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    const invite = Math.random().toString(36).slice(2, 8)

    const { data: s, error } = await supabase.from('servers')
      .insert({ name: nombre.trim(), owner_id: user.id, invite_code: invite })
      .select().single()
    if (error) return setMensaje('No se pudo crear: ' + error.message)

    // Si un trigger ya agregó al dueño, el error 23505 (duplicado) se ignora
    const { error: errMiembro } = await supabase.from('server_members')
      .insert({ server_id: s.id, user_id: user.id, role: 'owner' })
    if (errMiembro && errMiembro.code !== '23505')
      return setMensaje('No se pudo agregar al dueño: ' + errMiembro.message)

    // Crea #general solo si el servidor todavía no tiene canales
    const { data: canales } = await supabase.from('channels')
      .select('id').eq('server_id', s.id).limit(1)
    if (!canales || canales.length === 0) {
      const { error: errCanal } = await supabase.from('channels')
        .insert({ server_id: s.id, name: 'general' })
      if (errCanal) return setMensaje('No se pudo crear el canal: ' + errCanal.message)
    }

    navigate('/chat', { state: { servidorId: s.id } })
  }

  const unirse = async (e) => {
    e.preventDefault()
    const { error } = await supabase.rpc('unirse_servidor', { codigo: codigo.trim() })
    if (error) return setMensaje(error.message)

    // Ya somos miembros, así que RLS nos deja ver el servidor
    const { data: s } = await supabase.from('servers')
      .select('id').eq('invite_code', codigo.trim()).single()
    navigate('/chat', { state: { servidorId: s?.id } })
  }

  return (
    <div className="sv-bg">
      <div className="sv-card">
        <h1>Crea o únete a un servidor</h1>
        <p className="sub">Tu servidor es donde tú y tus amigos pasan el rato.</p>

        <form onSubmit={crear} className="sv-op">
          <h2>Crear mi propio servidor</h2>
          <p>Ponle un nombre y se crea con un canal #general.</p>
          <input className="form-control mb-2" placeholder="Nombre del servidor"
            value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <button className="btn btn-primary w-100">Crear servidor</button>
        </form>

        <form onSubmit={unirse} className="sv-op">
          <h2>¿Ya tienes una invitación?</h2>
          <p>Pega el código que te pasó tu amigo.</p>
          <input className="form-control mb-2" placeholder="Código de invitación"
            value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
          <button className="btn btn-outline-primary w-100">Unirme al servidor</button>
        </form>

        {mensaje && <div className="alert alert-warning">{mensaje}</div>}
        <button className="btn btn-link px-0" onClick={() => navigate('/chat')}>← Volver al chat</button>
      </div>
    </div>
  )
}

export default Servidores