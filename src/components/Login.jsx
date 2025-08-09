import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Eğer kullanıcı zaten giriş yapmışsa dashboard'a yönlendir
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Zaten loading durumundaysa işlemi durdur
    if (loading) {
      return;
    }
    
    // Email ve password kontrolleri
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    if (!trimmedEmail || !trimmedPassword) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }
    
    // Email format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Geçerli bir e-posta adresi girin');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      console.log('Giriş işlemi başlatılıyor...', { email: trimmedEmail });
      
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      
      console.log('Giriş başarılı:', userCredential.user);
      
      // Başarılı girişten sonra navigate
      navigate('/dashboard', { replace: true });
      
    } catch (error) {
      console.error('Giriş hatası:', error);
      
      // Hata mesajlarını Türkçe çevir
      let errorMessage = 'Giriş yapılamadı';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Yanlış şifre girdiniz';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Geçersiz e-posta adresi';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Bu hesap devre dışı bırakılmış';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'E-posta veya şifre hatalı';
          break;
        default:
          errorMessage = 'Giriş yapılırken bir hata oluştu: ' + error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>
      
      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-section">
              <div className="logo-icon">
                <span className="material-icons">restaurant</span>
              </div>
              <h1>Adel RRC</h1>
            </div>
            <h2>Yönetim Sistemi</h2>
            <p>Hesabınıza giriş yapın</p>
          </div>
          
          {error && (
            <div className="error-message">
              <span className="material-icons">error_outline</span>
              <span>{error}</span>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email">
                <span className="material-icons">email</span>
                E-posta Adresi
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Hata mesajını temizle
                  if (error) setError('');
                }}
                placeholder="ornek@email.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">
                <span className="material-icons">lock</span>
                Şifre
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    // Hata mesajını temizle
                    if (error) setError('');
                  }}
                  placeholder="Şifrenizi girin"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-icons">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="login-button" 
              disabled={loading || !email.trim() || !password.trim()}
              onClick={(e) => {
                // Form submit'in çalışmasını garanti et
                if (!loading && email.trim() && password.trim()) {
                  handleLogin(e);
                }
              }}
            >
              {loading ? (
                <>
                  <span className="material-icons spinning">hourglass_empty</span>
                  Giriş yapılıyor...
                </>
              ) : (
                <>
                  <span className="material-icons">login</span>
                  Giriş Yap
                </>
              )}
            </button>
          </form>
          
          <div className="login-footer">
            <div className="system-info">
              <span className="material-icons">info</span>
              <span>Adel RRC Yönetim Sistemi v1.0</span>
            </div>
            <div className="copyright-info">
              © {new Date().getFullYear()} Adel Restaurant RRC
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
