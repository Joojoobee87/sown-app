import React from 'react'

const Home: React.FC = () => {
  return (
    <div className="space-y-8">
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Sown
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Your modern web application built with React, TypeScript, and TailwindCSS.
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-2">Modern Stack</h3>
          <p className="text-gray-600">
            Built with the latest technologies including React 18, TypeScript, and Vite.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-2">Responsive Design</h3>
          <p className="text-gray-600">
            Fully responsive layout using TailwindCSS for a great mobile experience.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-2">Developer Experience</h3>
          <p className="text-gray-600">
            Hot module replacement and fast builds for an optimal development workflow.
          </p>
        </div>
      </section>
    </div>
  )
}

export default Home
