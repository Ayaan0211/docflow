'use client';

import { useState } from 'react';
import Image from 'next/image';
import './style/globals.css';
import GoogleLogo from './style/google.png';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  const showMessage = (message: string) => {
    const messageBox = document.getElementById('message-box');
    if (messageBox) {
      messageBox.textContent = message;
      messageBox.classList.remove('visible');
      void messageBox.offsetWidth;
      messageBox.classList.add('visible');
      setTimeout(() => messageBox.classList.remove('visible'), 3000);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement | null)?.value;

    if (!isLogin && password !== confirm) {
      showMessage('Passwords do not match.');
      return;
    }

    showMessage(`${isLogin ? 'Login' : 'Sign up'} successful! (Demo only)`);
    console.log(`${isLogin ? 'Login' : 'Signup'} with:`, { email, password });
  };

  const handleGoogleAuth = () => {
    console.log('Google authentication initiated.');
    showMessage('Google sign-in attempted. (Demo only)');
  };

  return (
    <div id="background">
      <div id="message-box">Message Placeholder</div>

      <div id="auth-card">
        <div className="toggle-header">
          <div className={`slider ${isLogin ? 'left' : 'right'}`}></div>
          <button
            className={`toggle-btn ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            className={`toggle-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>

        <h1>{isLogin ? 'Welcome Back' : 'Create Your Account'}</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required placeholder="••••••••" />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirm">Confirm Password</label>
              <input id="confirm" name="confirm" type="password" required placeholder="••••••••" />
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