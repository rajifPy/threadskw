'use client'

import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true)
    
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark)
    setIsDark(shouldBeDark)
    
    // Apply theme immediately
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if no manual preference is saved
      if (!localStorage.getItem('theme')) {
        const shouldBeDark = e.matches
        setIsDark(shouldBeDark)
        if (shouldBeDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [mounted])

  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    
    if (newTheme) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // Prevent flash of unstyled content
  if (!mounted) {
    return (
      <div className="flex items-center">
        <div className="w-[68px] h-[37.4px] opacity-0" /> {/* Invisible placeholder */}
      </div>
    )
  }

  return (
    <div className="flex items-center">
      <style jsx>{`
        .theme-switch {
          font-size: 17px;
          position: relative;
          display: inline-block;
          width: 4em;
          height: 2.2em;
          border-radius: 30px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }

        .theme-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #2a2a2a;
          transition: 0.4s;
          border-radius: 30px;
          overflow: hidden;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 1.2em;
          width: 1.2em;
          border-radius: 20px;
          left: 0.5em;
          bottom: 0.5em;
          transition: 0.4s;
          transition-timing-function: cubic-bezier(0.81, -0.04, 0.38, 1.5);
          box-shadow: inset 8px -4px 0px 0px #fff;
        }

        .theme-switch input:checked + .slider {
          background-color: #00a6ff;
        }

        .theme-switch input:checked + .slider:before {
          transform: translateX(1.8em);
          box-shadow: inset 15px -4px 0px 15px #ffcf48;
        }

        .star {
          background-color: #fff;
          border-radius: 50%;
          position: absolute;
          width: 5px;
          transition: all 0.4s;
          height: 5px;
        }

        .star_1 {
          left: 2.5em;
          top: 0.5em;
        }

        .star_2 {
          left: 2.2em;
          top: 1.2em;
        }

        .star_3 {
          left: 3em;
          top: 0.9em;
        }

        .theme-switch input:checked ~ .slider .star {
          opacity: 0;
        }

        .cloud {
          width: 3.5em;
          position: absolute;
          bottom: -1.4em;
          left: -1.1em;
          opacity: 0;
          transition: all 0.4s;
        }

        .theme-switch input:checked ~ .slider .cloud {
          opacity: 1;
        }

        @media (max-width: 768px) {
          .theme-switch {
            font-size: 14px;
          }
        }
      `}</style>

      <label className="theme-switch">
        <input 
          type="checkbox" 
          checked={isDark}
          onChange={toggleTheme}
          aria-label="Toggle dark mode"
        />
        <span className="slider">
          <div className="star star_1" />
          <div className="star star_2" />
          <div className="star star_3" />
          <svg viewBox="0 0 16 16" className="cloud">
            <path 
              transform="matrix(.77976 0 0 .78395-299.99-418.63)" 
              fill="#fff" 
              d="m391.84 540.91c-.421-.329-.949-.524-1.523-.524-1.351 0-2.451 1.084-2.485 2.435-1.395.526-2.388 1.88-2.388 3.466 0 1.874 1.385 3.423 3.182 3.667v.034h12.73v-.006c1.775-.104 3.182-1.584 3.182-3.395 0-1.747-1.309-3.186-2.994-3.379.007-.106.011-.214.011-.322 0-2.707-2.271-4.901-5.072-4.901-2.073 0-3.856 1.202-4.643 2.925" 
            />
          </svg>
        </span>
      </label>
    </div>
  )
}
