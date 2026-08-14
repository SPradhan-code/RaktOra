import React from 'react';

export default function RaktOraLogo({ className = "w-10 h-10", size = 40, showText = false, textClassName = "text-xl" }) {
  return (
    <div className="flex items-center space-x-2.5">
      <svg
        viewBox="0 0 500 560"
        className={className}
        style={{ width: size, height: size }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Vibrant Red Gradient for Blood Drop */}
          <linearGradient id="raktOraDropGrad" x1="250" y1="20" x2="250" y2="520" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF2E4D" />
            <stop offset="50%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#880E24" />
          </linearGradient>
          
          {/* Subtle Drop Shadow */}
          <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#991B1B" floodOpacity="0.3" />
          </filter>
        </defs>

        <g filter="url(#dropShadow)">
          {/* Blood Drop Outer Silhouette */}
          <path
            d="M 250 25 C 250 25 430 260 430 370 C 430 460 350 535 250 535 C 150 535 70 460 70 370 C 70 260 250 25 250 25 Z"
            fill="url(#raktOraDropGrad)"
          />

          {/* White Medical Cross near top */}
          <path
            d="M 234 110 C 234 104 239 99 245 99 L 255 99 C 261 99 266 104 266 110 L 266 130 L 286 130 C 292 130 297 135 297 141 L 297 151 C 297 157 292 162 286 162 L 266 162 L 266 182 C 266 188 261 193 255 193 L 245 193 C 239 193 234 188 234 182 L 234 162 L 214 162 C 208 162 203 157 203 151 L 203 141 C 203 135 208 130 214 130 L 234 130 Z"
            fill="#FFFFFF"
          />

          {/* Upper Hugging Hand (Sweeping from left-center to right) */}
          <path
            d="M 125 255 C 180 225 245 220 305 240 C 315 243 328 238 335 230 C 342 222 342 210 330 205 C 260 185 185 195 125 235 C 105 248 85 270 70 295 C 75 280 95 265 125 255 Z"
            fill="#FFFFFF"
            opacity="0.95"
          />

          {/* Hand 1 Palm and Outstretched Fingers */}
          <path
            d="M 130 250 C 185 225 250 225 315 248 L 330 230 C 310 222 285 218 260 218 C 240 218 220 222 200 228 M 315 248 C 340 252 360 248 375 238 C 382 233 388 238 382 245 C 372 255 352 265 328 265 L 305 265 L 332 278 C 340 282 342 290 334 294 C 325 298 312 295 300 288 L 275 272 M 315 248 C 335 258 355 268 370 280 C 376 285 372 293 365 293 C 350 293 330 282 310 272"
            fill="#FFFFFF"
          />
          
          {/* Smooth Dual Hugging Hands Cutout in Negative Space */}
          {/* Upper Arm & Hand */}
          <path
            d="M 72 355 C 120 300 210 230 320 245 C 345 248 368 238 378 226 C 382 221 386 226 384 231 C 378 245 360 262 332 268 C 300 275 260 270 220 285 C 185 298 152 322 135 348 C 115 378 118 412 130 442 C 112 422 92 395 72 355 Z"
            fill="#FFFFFF"
          />

          {/* Upper Hand Fingers */}
          <path
            d="M 332 268 C 352 268 375 260 388 248 C 392 244 396 250 392 255 C 382 268 360 282 338 285 M 325 275 C 345 280 368 278 382 268 C 386 265 390 270 386 275 C 375 288 352 300 330 300 M 315 285 C 335 292 358 295 372 288 C 376 286 380 291 376 295 C 362 308 340 318 318 315"
            stroke="#FFFFFF"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />

          {/* Lower Arm & Hand (Sweeping from right-bottom to left) */}
          <path
            d="M 425 390 C 375 450 285 500 180 480 C 155 475 132 485 122 497 C 118 502 114 497 116 492 C 122 478 140 461 168 455 C 200 448 240 453 280 438 C 315 425 348 401 365 375 C 385 345 382 311 370 281 C 388 301 408 328 425 390 Z"
            fill="#FFFFFF"
          />

          {/* Lower Hand Fingers */}
          <path
            d="M 168 455 C 148 455 125 463 112 475 C 108 479 104 473 108 468 C 118 455 140 441 162 438 M 175 448 C 155 443 132 445 118 455 C 114 458 110 453 114 448 C 125 435 148 423 170 423 M 185 438 C 165 431 142 428 128 435 C 124 437 120 432 124 428 C 138 415 160 405 182 408"
            stroke="#FFFFFF"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>

      {showText && (
        <span className={`font-black tracking-tight text-slate-900 flex items-center ${textClassName}`}>
          Rakt<span className="text-red-600">Ora</span>
        </span>
      )}
    </div>
  );
}
