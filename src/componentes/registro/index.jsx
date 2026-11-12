import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

function Registro() {
  const [form, setForm] = useState({ username: '', correo: '', password: '' })
  const [verPassword, setVerPassword] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { tipo: 'ok' | 'mal', texto }
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleRegistro = async (e) => {
    e.preventDefault()
    setMensaje(null)

    const username = form.username.trim()
    if (form.password.length < 6)
      return setMensaje({ tipo: 'mal', texto: 'La contraseña debe tener al menos 6 caracteres' })
    if (!username)
      return setMensaje({ tipo: 'mal', texto: 'Escribe un nombre de usuario' })

    setCargando(true)
    const { data, error } = await supabase.auth.signUp({
      email: form.correo,
      password: form.password,
      options: { data: { username } },
    })
    setCargando(false)
    if (error) return setMensaje({ tipo: 'mal', texto: error.message })

    // Si ya hay sesión (confirmación de correo apagada), crea el perfil
    if (data.session) {
      await supabase.from('profiles').upsert({ id: data.user.id, username })
      navigate('/chat')
    } else {
      setMensaje({ tipo: 'ok', texto: 'Cuenta creada. Confirma tu correo y luego inicia sesión.' })
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">🎮</div>
        <h1>Crea una cuenta</h1>
        <p className="sub">Únete a la conversación</p>

        <form onSubmit={handleRegistro}>
          <label>Correo</label>
          <input className="form-control" name="correo" type="email"
            value={form.correo} autoComplete="email" autoFocus
            onChange={handleChange} required />

          <label>Nombre de usuario</label>
          <input className="form-control" name="username"
            value={form.username} autoComplete="username"
            onChange={handleChange} required />

          <label>Contraseña</label>
          <div className="auth-pass">
            <input className="form-control" name="password"
              type={verPassword ? 'text' : 'password'}
              value={form.password} autoComplete="new-password"
              onChange={handleChange} required />
            <button type="button" className="auth-ver"
              title={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              onClick={() => setVerPassword(!verPassword)}>
              {verPassword ? '🙈' : '👁'}
            </button>
          </div>
          <div className="auth-ayuda">Mínimo 6 caracteres</div>

          <button className="btn btn-primary w-100" disabled={cargando}>
            {cargando ? 'Creando cuenta...' : 'Continuar'}
          </button>
        </form>

        {mensaje && (
          <div className={mensaje.tipo === 'ok' ? 'auth-ok' : 'auth-error'}>{mensaje.texto}</div>
        )}

        <div className="auth-pie">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login') }}>
            ¿Ya tienes una cuenta?
          </a>
        </div>
      </div>
    </div>
  )
}

export default Registro