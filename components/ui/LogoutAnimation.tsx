// components/ui/LogoutAnimation.tsx
import React, { useEffect, useRef } from 'react';

interface LogoutAnimationProps {
  text?: string;
  onComplete?: () => void;
}

export default function LogoutAnimation({ 
  text = 'Logging out...', 
  onComplete 
}: LogoutAnimationProps) {
  
  // ✅ TAMBAHAN: Audio ref untuk washing machine sound
  const washingSoundRef = useRef<HTMLAudioElement | null>(null);

  // ✅ TAMBAHAN: Initialize dan play sound
  useEffect(() => {
    console.log('🧺 Initializing washing machine sound...');
    
    // Create audio element
    washingSoundRef.current = new Audio('/sound/washing-machine-90458.mp3');
    
    // Set volume
    if (washingSoundRef.current) {
      washingSoundRef.current.volume = 0.7;
    }
    
    // Play sound
    washingSoundRef.current.play()
      .then(() => console.log('✅ Washing machine sound playing!'))
      .catch(err => console.error('❌ Washing machine sound error:', err));
    
    return () => {
      // Cleanup
      if (washingSoundRef.current) {
        washingSoundRef.current.pause();
        washingSoundRef.current = null;
      }
    };
  }, []);

  // Auto-redirect setelah animasi selesai (5 detik - sesuai durasi sound)
  useEffect(() => {
    if (onComplete) {
      const timer = setTimeout(onComplete, 5000);
      return () => clearTimeout(timer);
    }
  }, [onComplete]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 transition-colors">
      <style jsx>{`
        .washing-machine {
          width: 120px;
          height: 150px;
          background-color: #fff;
          background-repeat: no-repeat;
          background-image: linear-gradient(#ddd 50%, #bbb 51%),
            linear-gradient(#ddd, #ddd), 
            linear-gradient(#ddd, #ddd),
            radial-gradient(ellipse at center, #aaa 25%, #eee 26%, #eee 50%, #0000 55%),
            radial-gradient(ellipse at center, #aaa 25%, #eee 26%, #eee 50%, #0000 55%),
            radial-gradient(ellipse at center, #aaa 25%, #eee 26%, #eee 50%, #0000 55%);
          background-position: 0 20px, 45px 0, 8px 6px, 55px 3px, 75px 3px, 95px 3px;
          background-size: 100% 4px, 1px 23px, 30px 8px, 15px 15px, 15px 15px, 15px 15px;
          position: relative;
          border-radius: 6%;
          animation: shake 5s ease-in-out infinite;
          transform-origin: 60px 180px;
        }

        .dark .washing-machine {
          background-color: #374151;
          background-image: linear-gradient(#4b5563 50%, #6b7280 51%),
            linear-gradient(#4b5563, #4b5563), 
            linear-gradient(#4b5563, #4b5563),
            radial-gradient(ellipse at center, #6b7280 25%, #9ca3af 26%, #9ca3af 50%, #0000 55%),
            radial-gradient(ellipse at center, #6b7280 25%, #9ca3af 26%, #9ca3af 50%, #0000 55%),
            radial-gradient(ellipse at center, #6b7280 25%, #9ca3af 26%, #9ca3af 50%, #0000 55%);
        }

        .washing-machine:before {
          content: "";
          position: absolute;
          left: 5px;
          top: 100%;
          width: 7px;
          height: 5px;
          background: #aaa;
          border-radius: 0 0 4px 4px;
          box-shadow: 102px 0 #aaa;
        }

        .dark .washing-machine:before {
          background: #6b7280;
          box-shadow: 102px 0 #6b7280;
        }

        .washing-machine:after {
          content: "";
          position: absolute;
          width: 95px;
          height: 95px;
          left: 0;
          right: 0;
          margin: auto;
          bottom: 20px;
          background-color: #bbdefb;
          background-image: linear-gradient(to right, #0004 0%, #0004 49%, #0000 50%, #0000 100%),
            linear-gradient(135deg, #64b5f6 50%, #607d8b 51%);
          background-size: 30px 100%, 90px 80px;
          border-radius: 50%;
          background-repeat: repeat, no-repeat;
          background-position: 0 0;
          box-sizing: border-box;
          border: 10px solid #DDD;
          box-shadow: 0 0 0 4px #999 inset, 0 0 6px 6px #0004 inset;
          animation: spin 5s ease-in-out infinite;
        }

        .dark .washing-machine:after {
          background-color: #3b82f6;
          background-image: linear-gradient(to right, #0004 0%, #0004 49%, #0000 50%, #0000 100%),
            linear-gradient(135deg, #60a5fa 50%, #475569 51%);
          border: 10px solid #4b5563;
          box-shadow: 0 0 0 4px #6b7280 inset, 0 0 6px 6px #0004 inset;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(360deg);
          }
          75% {
            transform: rotate(750deg);
          }
          100% {
            transform: rotate(1800deg);
          }
        }

        @keyframes shake {
          65%, 80%, 88%, 96% {
            transform: rotate(0.5deg);
          }
          50%, 75%, 84%, 92% {
            transform: rotate(-0.5deg);
          }
          0%, 50%, 100% {
            transform: rotate(0);
          }
        }

        .progress-bar {
          width: 200px;
          height: 4px;
          background: #e0e0e0;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 2rem;
        }

        .dark .progress-bar {
          background: #374151;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e, #16a34a);
          animation: progress 5s linear;
        }

        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        .fade-in {
          animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="text-center fade-in">
        <div className="washing-machine mx-auto mb-8"></div>
        
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          Cleaning up your session...
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {text}
        </p>

        <div className="progress-bar mx-auto">
          <div className="progress-bar-fill"></div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          🧼 Washing away your data...
        </p>
      </div>
    </div>
  );
}
