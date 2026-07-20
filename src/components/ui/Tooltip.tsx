import React, { useState, useRef, useEffect } from 'react';

export interface TooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  children,
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [actualPosition, setActualPosition] = useState(position);
  
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let newPosition = position;
    let top = 0;
    let left = 0;

    // Helper to check boundaries and auto-flip
    const spaceTop = triggerRect.top;
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;

    if (position === 'top' && spaceTop < tooltipRect.height + 8 && spaceBottom > tooltipRect.height + 8) {
      newPosition = 'bottom';
    } else if (position === 'bottom' && spaceBottom < tooltipRect.height + 8 && spaceTop > tooltipRect.height + 8) {
      newPosition = 'top';
    } else if (position === 'left' && spaceLeft < tooltipRect.width + 8 && spaceRight > tooltipRect.width + 8) {
      newPosition = 'right';
    } else if (position === 'right' && spaceRight < tooltipRect.width + 8 && spaceLeft > tooltipRect.width + 8) {
      newPosition = 'left';
    }

    setActualPosition(newPosition);

    // Coordinate calculation based on final chosen position
    switch (newPosition) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8 + scrollY;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2 + scrollX;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8 + scrollY;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2 + scrollX;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2 + scrollY;
        left = triggerRect.left - tooltipRect.width - 8 + scrollX;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2 + scrollY;
        left = triggerRect.right + 8 + scrollX;
        break;
    }

    // Keep within horizontal screen bounds
    if (left < 4) left = 4;
    if (left + tooltipRect.width > viewportWidth - 4) {
      left = viewportWidth - tooltipRect.width - 4;
    }

    // Keep within vertical screen bounds
    if (top < 4) top = 4;

    setCoords({ top, left });
  };

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
      // Recalculate on scroll/resize for proper overlay alignment
      window.addEventListener('scroll', calculatePosition, { passive: true });
      window.addEventListener('resize', calculatePosition);
      return () => {
        window.removeEventListener('scroll', calculatePosition);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isVisible]);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  // Mobile Tap / Long Press Support
  const handleTouchStart = () => {
    showTooltip();
  };

  // Close when tapping anywhere else (mobile)
  useEffect(() => {
    if (!isVisible) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        triggerRef.current && 
        !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current && 
        !tooltipRef.current.contains(e.target as Node)
      ) {
        hideTooltip();
      }
    };
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isVisible]);

  // Arrow style rotation and placement classes
  const getArrowClass = () => {
    switch (actualPosition) {
      case 'top':
        return 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-zinc-800 border-l-transparent border-r-transparent border-b-transparent';
      case 'bottom':
        return 'top-[-4px] left-1/2 -translate-x-1/2 border-b-zinc-800 border-l-transparent border-r-transparent border-t-transparent';
      case 'left':
        return 'right-[-4px] top-1/2 -translate-y-1/2 border-l-zinc-800 border-t-transparent border-b-transparent border-r-transparent';
      case 'right':
        return 'left-[-4px] top-1/2 -translate-y-1/2 border-r-zinc-800 border-t-transparent border-b-transparent border-l-transparent';
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-block"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onTouchStart={handleTouchStart}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
          className="z-[9999] bg-zinc-800 border border-zinc-700 text-white text-[10px] md:text-xs font-medium py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap pointer-events-none select-none animate-in fade-in zoom-in-95 duration-100"
        >
          {content}
          <div className={`absolute w-0 h-0 border-4 ${getArrowClass()}`} />
        </div>
      )}
    </>
  );
};
