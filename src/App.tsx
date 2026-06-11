import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-md">
      <div className="bg-card border border-border p-xl rounded-card shadow-lg max-w-md w-full text-center">
        <h1 className="text-3xl text-primary font-bold mb-md">BoutikOS</h1>
        <p className="text-text2 mb-lg">
          L'application de gestion hors-ligne pour les commerçants d'Afrique de l'Ouest.
        </p>
        
        <div className="flex flex-col gap-sm">
          <button
            type="button"
            className="h-12 px-lg bg-primary text-white font-medium rounded-button hover:opacity-90 active:scale-95 transition-all w-full"
            onClick={() => setCount((c) => c + 1)}
          >
            Ventes enregistrées : <span className="numeric font-bold">{count}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
