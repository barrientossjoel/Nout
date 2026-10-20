import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { Google, generateState, generateCodeVerifier } from 'arctic';
import { AuthService } from '../services/auth.service.js';

const authRouter = new Hono();

// Helper for auth session cookies
const setAuthCookie = (c: any, sessionId: string, expiresAt: Date) => {
    setCookie(c, 'auth_session', sessionId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'Lax'
    });
};

authRouter.post('/register', async (c) => {
    const { email, password, name } = await c.req.json();
    if (!email || !password || !name) return c.json({ error: 'Missing fields' }, 400);

    const existingUser = await AuthService.getUserByEmail(email);
    if (existingUser) return c.json({ error: 'Email already in use' }, 400);

    const newUser = await AuthService.registerUser(email, password, name);
    const { sessionId, expiresAt } = await AuthService.createSession(newUser.id);
    setAuthCookie(c, sessionId, expiresAt);

    return c.json({ user: { id: newUser.id, email: newUser.email, name: newUser.name } });
});

authRouter.post('/login', async (c) => {
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ error: 'Missing fields' }, 400);

    const existingUser = await AuthService.getUserByEmail(email);
    if (!existingUser || !existingUser.passwordHash) {
        return c.json({ error: 'Invalid email or password' }, 400);
    }

    const validPassword = await bcrypt.compare(password, existingUser.passwordHash);
    if (!validPassword) return c.json({ error: 'Invalid email or password' }, 400);

    const { sessionId, expiresAt } = await AuthService.createSession(existingUser.id);
    setAuthCookie(c, sessionId, expiresAt);

    return c.json({ user: { id: existingUser.id, email: existingUser.email, name: existingUser.name, avatarUrl: existingUser.avatarUrl } });
});

authRouter.post('/logout', async (c) => {
    const sessionId = getCookie(c, 'auth_session');
    if (sessionId) await AuthService.deleteSession(sessionId);
    deleteCookie(c, 'auth_session', { path: '/' });
    return c.json({ success: true });
});

authRouter.get('/me', async (c) => {
    const sessionId = getCookie(c, 'auth_session');
    if (!sessionId) return c.json({ user: null });

    const user = await AuthService.validateSession(sessionId);
    if (!user) {
        deleteCookie(c, 'auth_session', { path: '/' });
        return c.json({ user: null });
    }

    return c.json({ user });
});

// GOOGLE OAUTH
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

const getGoogleAuth = (reqUrl: string) => {
    const url = new URL(reqUrl);
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    return new Google(googleClientId, googleClientSecret, redirectUri);
};

authRouter.get('/google', async (c) => {
    const flowId = c.req.query('flowId') || '';
    const googleAuth = getGoogleAuth(c.req.url);
    const rawState = generateState();
    const state = flowId ? `${flowId}__${rawState}` : rawState;
    const codeVerifier = generateCodeVerifier();

    setCookie(c, 'google_oauth_data', JSON.stringify({ state, codeVerifier }), {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: 'Lax'
    });

    const url = googleAuth.createAuthorizationURL(state, codeVerifier, ['profile', 'email']);
    return c.redirect(url.toString());
});

authRouter.get('/google/callback', async (c) => {
    const googleAuth = getGoogleAuth(c.req.url);
    const code = c.req.query('code');
    const state = c.req.query('state');
    const storedCookieData = getCookie(c, 'google_oauth_data');

    if (!code || !state || !storedCookieData) return c.json({ error: 'Missing oauth data' }, 400);

    const { state: storedState, codeVerifier: storedCodeVerifier } = JSON.parse(storedCookieData);
    if (state !== storedState) return c.json({ error: 'Invalid state' }, 400);

    const flowId = state.includes('__') ? state.split('__')[0] : null;

    try {
        const tokens = await googleAuth.validateAuthorizationCode(code, storedCodeVerifier);
        const googleUserResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokens.accessToken()}` }
        });
        const googleUser = await googleUserResponse.json() as any;

        let user = await AuthService.getUserByGoogleId(googleUser.sub);

        if (!user) {
            user = await AuthService.getUserByEmail(googleUser.email);
            if (user) {
                await AuthService.linkGoogleAccount(user.id, googleUser.sub, googleUser.picture);
            } else {
                user = await AuthService.createGoogleUser(googleUser.email, googleUser.name, googleUser.sub, googleUser.picture);
            }
        }

        const { sessionId, expiresAt } = await AuthService.createSession(user.id);
        setAuthCookie(c, sessionId, expiresAt);

        if (flowId) {
            await AuthService.createSessionWithId(flowId, user.id);
            return c.html(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Nout - Sesión Iniciada</title>
                    <style>
                        body {
                            background-color: #121215;
                            color: #ffffff;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            margin: 0;
                            padding: 24px;
                            box-sizing: border-box;
                            text-align: center;
                        }
                        .card {
                            background: #1a1a20;
                            border: 1px solid #2a2a35;
                            border-radius: 16px;
                            padding: 36px 24px;
                            max-width: 400px;
                            width: 100%;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                        }
                        .icon { font-size: 48px; margin-bottom: 16px; }
                        h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; color: #fff; }
                        p { font-size: 14px; color: #9aa0a6; margin: 0 0 24px; line-height: 1.5; }
                        .btn {
                            display: inline-block;
                            background: #2563eb;
                            color: #ffffff;
                            font-size: 15px;
                            font-weight: 600;
                            text-decoration: none;
                            padding: 12px 28px;
                            border-radius: 10px;
                            box-shadow: 0 4px 14px rgba(37,99,235,0.4);
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">✨</div>
                        <h1>¡Sesión iniciada con éxito!</h1>
                        <p>Tu cuenta de Google fue vinculada correctamente. Pulsa abajo para regresar a Nout.</p>
                        <a href="nout://auth?flowId=${flowId}" class="btn">Volver a Nout</a>
                    </div>
                    <script>
                        window.location.href = "nout://auth?flowId=${flowId}";
                    </script>
                </body>
                </html>
            `);
        }

        const frontendUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173/';
        return c.redirect(frontendUrl);
    } catch (e: any) {
        console.error('Google OAuth error:', e);
        return c.json({ error: 'Authentication failed' }, 500);
    }
});

authRouter.get('/mobile-session', async (c) => {
    const flowId = c.req.query('flowId');
    if (!flowId) return c.json({ error: 'Missing flowId' }, 400);

    const user = await AuthService.validateSession(flowId);
    if (!user) {
        return c.json({ pending: true }, 202);
    }

    return c.json({ user, success: true });
});

export { authRouter };
