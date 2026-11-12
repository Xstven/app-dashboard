import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

function Login() {
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password })
    setCargando(false)
    if (error) setError('Correo o contraseña no válidos')
    else navigate('/chat')
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">🎮</div>
        <h1>¡Hola de nuevo!</h1>
        <p className="sub">Nos alegra verte otra vez</p>

        <form onSubmit={handleLogin}>
          <label>Correo</label>
          <input className="form-control" type="email" value={correo}
            autoComplete="email" autoFocus
            onChange={(e) => setCorreo(e.target.value)} required />

          <label>Contraseña</label>
          <div className="auth-pass">
            <input className="form-control" type={verPassword ? 'text' : 'password'}
              value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="auth-ver"
              title={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              onClick={() => setVerPassword(!verPassword)}>
              {verPassword ? '🙈' : '👁'}
            </button>
          </div>

          <button className="btn btn-primary w-100" disabled={cargando}>
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-pie">
          ¿Necesitas una cuenta?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/registro') }}>Regístrate</a>
        </div>
      </div>
    </div>
  )
}

export default Login