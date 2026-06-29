import { handleLogin, handleForgotPassword, handleSignup, updateUserProfile } from '../../auth.js';
import { showNotification } from '../ui.js';

/**
 * Wires auth page form toggles and submit handlers.
 * Keeps auth UI behavior isolated from app bootstrap logic.
 */
export function setupAuthFormHandlers() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const showSignupBtn = document.getElementById('show-signup-btn');
  const showLoginBtn = document.getElementById('show-login-btn');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');

  if (showSignupBtn) {
    showSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm?.classList.add('hidden');
      signupForm?.classList.remove('hidden');
      document.getElementById('auth-toggle-text')?.classList.add('hidden');
      document.getElementById('signup-toggle-text')?.classList.remove('hidden');
      document.getElementById('auth-error')?.classList.add('hidden');
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      signupForm?.classList.add('hidden');
      loginForm?.classList.remove('hidden');
      document.getElementById('signup-toggle-text')?.classList.add('hidden');
      document.getElementById('auth-toggle-text')?.classList.remove('hidden');
      document.getElementById('auth-error')?.classList.add('hidden');
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value;
      const password = document.getElementById('login-password')?.value;
      const errorEl = document.getElementById('auth-error');
      const loadingEl = document.getElementById('auth-loading');

      try {
        loadingEl?.classList.remove('hidden');
        errorEl?.classList.add('hidden');
        await handleLogin(email, password);
        // Success: auth state listener in main.js handles navigation/update.
      } catch (error) {
        loadingEl?.classList.add('hidden');
        errorEl?.classList.remove('hidden');
        errorEl.textContent = error.message || 'Login failed. Please try again.';
        console.error('Login error:', error);
      }
    });
  }

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async () => {
      const emailOrUsername = document.getElementById('login-email')?.value?.trim() || '';
      const errorEl = document.getElementById('auth-error');
      const loadingEl = document.getElementById('auth-loading');

      if (!emailOrUsername) {
        errorEl?.classList.remove('hidden');
        errorEl.textContent = 'Enter your email or username above, then click Forgot password.';
        return;
      }

      // If it's a username, show a note that they need their email
      if (!emailOrUsername.includes('@')) {
        errorEl?.classList.remove('hidden');
        errorEl.textContent = 'Please enter the email associated with your account to reset your password.';
        return;
      }

      try {
        loadingEl?.classList.remove('hidden');
        errorEl?.classList.add('hidden');
        await handleForgotPassword(emailOrUsername);
        loadingEl?.classList.add('hidden');
        showNotification('Password reset email sent. Check your inbox.', false, 4500);
      } catch (error) {
        loadingEl?.classList.add('hidden');
        errorEl?.classList.remove('hidden');
        errorEl.textContent = error.message || 'Could not send password reset email. Please try again.';
        console.error('Forgot password error:', error);
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email')?.value;
      const username = document.getElementById('signup-username')?.value;
      const password = document.getElementById('signup-password')?.value;
      const subscribed = document.getElementById('signup-mailing')?.checked;
      const errorEl = document.getElementById('auth-error');
      const loadingEl = document.getElementById('auth-loading');

      try {
        loadingEl?.classList.remove('hidden');
        errorEl?.classList.add('hidden');

        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        const user = await handleSignup(email, password, username);

        await updateUserProfile(user.uid, {
          username,
          email,
          subscribed
        });

        loadingEl?.classList.add('hidden');
        // Success: auth state listener in main.js handles navigation/update.
      } catch (error) {
        loadingEl?.classList.add('hidden');
        errorEl?.classList.remove('hidden');
        errorEl.textContent = error.message || 'Signup failed. Please try again.';
        console.error('Signup error:', error);
      }
    });
  }
}
