import { Link, useLocation } from 'react-router-dom'

export default function NavBar() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/scan', label: 'Scan', icon: '📷' },
    { path: '/library', label: 'Library', icon: '📚' },
    { path: '/calendar', label: 'Calendar', icon: '📅' }
  ]

  return (
    <nav className="bg-white border-t border-gray-200">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                isActive 
                  ? 'text-green-600 bg-green-50' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
