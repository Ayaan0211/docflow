'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '../api';
import './style/globals.css';
import GoogleLogo from './style/google.png';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState(''); // << added here
  const router = useRouter();

  const showMessage = (msg: string) => {
    const box = document.getElementById('message-box');
    if (!box) return;
    box.textContent = msg;
    box.classList.remove('visible');
    void box.offsetWidth;
    box.classList.add('visible');
    setTimeout(() => box.classList.remove('visible'), 3000);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement | null)?.value;

    if (!isLogin && password !== confirm) {
      showMessage('Passwords do not match.');
      return;
    }

    try {
      if (isLogin) {
        await api.auth.signin(email, password);
      } else {
        await api.auth.signup(username, email, password); // << uses username explicitly now
      }
      router.push('/home');
    } catch (err: any) {
      showMessage(err.message || 'Authentication failed.');
    }
  };

  const handleGoogleAuth = () => {
    api.auth.initiateGoogleAuth();
  };

  return (
    <div id="background">
      <div id="message-box">Message Placeholder</div>

      <div id="auth-card">
        <div className="toggle-header">
          <div className={`slider ${isLogin ? 'left' : 'right'}`} />
          <button className={`toggle-btn ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Login</button>
          <button className={`toggle-btn ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Sign Up</button>
        </div>

        <h1>{isLogin ? 'Welcome Back' : 'Create Your Account'}</h1>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirm">Confirm Password</label>
              <input id="confirm" name="confirm" type="password" required />
            </div>
          )}

          <button type="submit">{isLogin ? 'Log In' : 'Create Account'}</button>
        </form>

        {!isLogin && (
          <button id="google-auth" onClick={handleGoogleAuth}>
            <Image src={GoogleLogo} alt="Google logo" width={20} height={20} />
            Continue with Google
          </button>
        )}
      </div>
    </div>
  );
}