import React from 'react';

const LoadingCube = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
      <style jsx>{`
        .wrapper-grid {
          --animation-duration: 2.1s;
          --cube-color: #0000;
          --highlight-color: #22c55e;
          --cube-width: 48px;
          --cube-height: 48px;
          --font-size: 1.8em;

          position: relative;
          inset: 0;

          display: grid;
          grid-template-columns: repeat(7, var(--cube-width));
          grid-template-rows: auto;
          grid-gap: 0;

          width: calc(7 * var(--cube-width));
          height: var(--cube-height);
          perspective: 350px;

          font-family: "Inter", "Poppins", sans-serif;
          font-size: var(--font-size);
          font-weight: 800;
          color: transparent;
        }

        .cube {
          position: relative;
          transform-style: preserve-3d;
        }

        .face {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          width: var(--cube-width);
          height: var(--cube-height);
          background-color: var(--cube-color);
        }

        .face-front {
          transform: rotateY(0deg) translateZ(calc(var(--cube-width) / 2));
        }
        .face-back {
          transform: rotateY(180deg) translateZ(calc(var(--cube-width) / 2));
          opacity: 0.6;
        }
        .face-left {
          transform: rotateY(-90deg) translateZ(calc(var(--cube-width) / 2));
          opacity: 0.6;
        }
        .face-right {
          transform: rotateY(90deg) translateZ(calc(var(--cube-width) / 2));
          opacity: 0.6;
        }
        .face-top {
          height: var(--cube-width);
          transform: rotateX(90deg) translateZ(calc(var(--cube-width) / 2));
          opacity: 0.8;
        }
        .face-bottom {
          height: var(--cube-width);
          transform: rotateX(-90deg)
            translateZ(calc(var(--cube-height) - var(--cube-width) * 0.5));
          opacity: 0.8;
        }

        .cube:nth-child(1) {
          z-index: 0;
          animation-delay: 0s;
        }
        .cube:nth-child(2) {
          z-index: 1;
          animation-delay: 0.2s;
        }
        .cube:nth-child(3) {
          z-index: 2;
          animation-delay: 0.4s;
        }
        .cube:nth-child(4) {
          z-index: 3;
          animation-delay: 0.6s;
        }
        .cube:nth-child(5) {
          z-index: 2;
          animation-delay: 0.8s;
        }
        .cube:nth-child(6) {
          z-index: 1;
          animation-delay: 1s;
        }
        .cube:nth-child(7) {
          z-index: 0;
          animation-delay: 1.2s;
        }

        .cube {
          animation: translate-z var(--animation-duration) ease-in-out infinite;
        }
        .cube .face {
          animation:
            face-color var(--animation-duration) ease-in-out infinite,
            edge-glow var(--animation-duration) ease-in-out infinite;
          animation-delay: inherit;
        }
        .cube .face.face-front {
          animation:
            face-color var(--animation-duration) ease-in-out infinite,
            face-glow var(--animation-duration) ease-in-out infinite,
            edge-glow var(--animation-duration) ease-in-out infinite;
          animation-delay: inherit;
        }

        @keyframes translate-z {
          0%,
          40%,
          100% {
            transform: translateZ(-2px);
          }
          30% {
            transform: translateZ(16px) translateY(-1px);
          }
        }
        @keyframes face-color {
          0%,
          50%,
          100% {
            background-color: var(--cube-color);
          }
          10% {
            background-color: var(--highlight-color);
          }
        }
        @keyframes face-glow {
          0%,
          50%,
          100% {
            color: #fff0;
            filter: none;
          }
          30% {
            color: #fff;
            filter: drop-shadow(0 14px 10px var(--highlight-color));
          }
        }
        @keyframes edge-glow {
          0%,
          50%,
          100% {
            box-shadow: none;
          }
          30% {
            box-shadow: 0 0 15px rgba(34, 197, 94, 0.6);
          }
        }
      `}</style>

      <div className="text-center">
        <div className="wrapper-grid mx-auto">
          <div className="cube">
            <div className="face face-front">L</div>
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
          <div className="cube">
            <div className="face face-front">O</div>
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
          <div className="cube">
            <div className="face face-front">A</div>
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
          <div className="cube">
            <div className="face face-front">D</div>
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
          <div className="cube">
            <div className="face face-front">I</div>
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
          <div className="cube">
            <div className="face face-front">N</div>
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
          <div className="cube">
            <div className="face face-front">G</div>
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
        </div>
        
        <p className="mt-8 text-gray-600 text-lg font-medium animate-pulse">
          Mohon tunggu sebentar...
        </p>
      </div>
    </div>
  );
};

export default LoadingCube;
