import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft } from 'lucide-react';

const translations = {
    en: {
        back: "Back",
        title: "Create an Account",
        name: "Name",
        email: "Email",
        password: "Password",
        signup: "Sign Up",
        continueWith: "Or continue with",
        haveAccount: "Already have an account?",
        login: "Log in",
        regFailed: "Registration failed",
        error: "An error occurred during registration",
        regSuccess: "Registration successful! Redirecting..."
    },
    es: {
        back: "Volver",
        title: "Crea una cuenta",
        name: "Nombre",
        email: "Mail",
        password: "Contraseña",
        signup: "Regístrate",
        continueWith: "O continuar con",
        haveAccount: "¿Ya tienes una cuenta?",
        login: "Iniciar Sesión",
        regFailed: "Error al registrarse",
        error: "Ocurrió un error al registrarse",
        regSuccess: "¡Registro exitoso! Redirigiendo..."
    }
};

export default function Register() {
    const { setUser } = useAuth();
    const [lang] = useState<'en' | 'es'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('closure_lang') as 'en' | 'es') || 'en';
        }
        return 'en';
    });
    const t = translations[lang];

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || t.regFailed);
            } else {
                setSuccess(t.regSuccess || "Registration successful!");
                setTimeout(() => {
                    setUser(data.user);
                    window.history.pushState({}, '', '/');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }, 1500);
            }
        } catch (err) {
            setError(t.error);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = '/api/auth/google';
    };

    const navigate = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
        e.preventDefault();
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return (
        <div className="flex bg-background justify-center items-center h-screen w-full text-foreground relative selection:bg-neutral-800 dark">
            <a href="/" onClick={(e) => navigate(e, '/')} className="absolute top-8 left-8 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group">
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-medium">{t.back}</span>
            </a>

            <div className="w-full max-w-sm p-8 bg-[#121216] border border-white/[0.12] rounded-xl shadow-2xl relative z-10 my-auto">
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-2.5">
                        <img src="/icon_cropped.png" alt="Closure Logo" className="w-5 h-5 object-contain" />
                        <span className="text-2xl font-semibold tracking-tight text-foreground lowercase" style={{ fontFamily: "'Playfair Display', serif" }}>closure</span>
                    </div>
                </div>

                <h2 className="text-xl font-medium mb-6 text-center text-foreground">{t.title}</h2>
                {error && <p className="mb-4 text-sm text-red-500 text-center bg-red-500/10 py-2 rounded-md border border-red-500/20">{error}</p>}
                {success && <p className="mb-4 text-sm text-green-500 text-center bg-green-500/10 py-2 rounded-md border border-green-500/20">{success}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-muted-foreground">{t.name}</Label>
                        <Input
                            id="name"
                            type="text"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-muted-foreground">{t.email}</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="m@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-muted-foreground">{t.password}</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <Button type="submit" className="w-full bg-white/90 text-black hover:bg-white rounded-[6px] transition-colors mt-2 h-10 font-medium">
                        {t.signup}
                    </Button>
                </form>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-[#121216] text-muted-foreground">{t.continueWith}</span>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-[6px] h-10 font-medium border-border hover:bg-accent hover:text-accent-foreground"
                    onClick={handleGoogleLogin}
                >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    Google
                </Button>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                    {t.haveAccount}{' '}
                    <a href="/login" onClick={(e) => navigate(e, '/login')} className="text-foreground hover:underline">
                        {t.login}
                    </a>
                </p>
            </div>
            {/* Ambient Background Glows like Landing */}
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none -z-10" />
            <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-white/[0.02] rounded-full blur-[100px] pointer-events-none -z-10" />
        </div>
    );
}
