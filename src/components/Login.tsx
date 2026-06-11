import React, { useState } from 'react'
import { z } from 'zod'
import { Lock, Mail, AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

// 1. ZOD VALIDATION SCHEMA
const loginSchema = z.object({
  email: z.string().email({ message: 'Adresse email invalide' }),
  password: z.string().min(6, { message: 'Le mot de passe doit faire au moins 6 caractères' }),
})

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setIsSubmitting(true)

    // Validate using Zod
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const formattedErrors: { email?: string; password?: string } = {}
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as 'email' | 'password'
        formattedErrors[path] = issue.message
      })
      setFieldErrors(formattedErrors)
      setIsSubmitting(false)
      return
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message === 'Invalid login credentials' 
          ? 'Identifiants incorrects. Veuillez réessayer.' 
          : authError.message)
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Une erreur inattendue est survenue. Veuillez vérifier votre connexion.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-md bg-bg font-body">
      <div className="bg-card border border-border p-xl rounded-card shadow-lg max-w-md w-full">
        {/* Brand header */}
        <div className="text-center mb-xl">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-md">
            <span className="text-3xl">🏪</span>
          </div>
          <h1 className="text-3xl text-primary font-bold tracking-tight">BoutikOS</h1>
          <p className="text-text2 text-sm mt-xs">
            Connectez-vous pour gérer votre caisse et vos stocks.
          </p>
        </div>

        {/* Global error alert */}
        {error && (
          <div className="bg-error/10 border border-error/20 p-md rounded-card flex items-start gap-sm mb-md text-error text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          {/* Email field */}
          <div className="flex flex-col gap-xs">
            <label htmlFor="email" className="text-sm font-semibold text-text">
              Adresse e-mail
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none text-text2">
                <Mail className="w-5 h-5" />
              </span>
              <input
                id="email"
                type="email"
                placeholder="exemple@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className={`h-12 w-full pl-11 pr-md border rounded-button bg-bg text-text focus:outline-none focus:border-primary transition-all text-base ${
                  fieldErrors.email ? 'border-error' : 'border-border'
                }`}
              />
            </div>
            {fieldErrors.email && (
              <span className="text-error text-xs font-medium pl-xs">{fieldErrors.email}</span>
            )}
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-xs">
            <label htmlFor="password" className="text-sm font-semibold text-text">
              Mot de passe
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none text-text2">
                <Lock className="w-5 h-5" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className={`h-12 w-full pl-11 pr-11 border rounded-button bg-bg text-text focus:outline-none focus:border-primary transition-all text-base ${
                  fieldErrors.password ? 'border-error' : 'border-border'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-md flex items-center text-text2 hover:text-text focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="text-error text-xs font-medium pl-xs">{fieldErrors.password}</span>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 mt-sm bg-primary text-white font-bold rounded-button hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-sm disabled:opacity-50 cursor-pointer shadow-md"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connexion en cours...</span>
              </>
            ) : (
              <span>Se connecter</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
