'use client'; 
import { useState } from 'react';
import "./style/globals.css";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);

  const showMessage = (message: string) => {
    console.log("STATUS:", message);
  };

  const title = isLogin ? 'Log In' : 'Sign Up';
  const buttonText = isLogin ? 'Log In' : 'Create Account';
  const toggleText = isLogin ? 'Need an account?' : 'Already have an account?';
  const toggleLinkText = isLogin ? 'Sign Up' : 'Log In';


  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    
    console.log(`${title} attempt with:`, { email, password });
    showMessage(`${title} attempted successfully. Check the console for details.`);
  };

  return (
    <div>
      
      {}

      <div>
        <h1>{title}</h1>
        
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="  "
            />
          </div>

          <button
            type="submit"
          >
            {buttonText}
          </button>
        </form>

        <div>
          <p>
            {toggleText}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              type="button"
            >
              {toggleLinkText}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}