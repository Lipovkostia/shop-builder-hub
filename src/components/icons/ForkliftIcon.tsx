interface ForkliftIconProps {
  boxCount?: number;
  className?: string;
}

export function ForkliftIcon({ boxCount = 0, className = "w-4 h-4" }: ForkliftIconProps) {
  // Ограничиваем количество коробок от 0 до 3
  const boxes = Math.min(Math.max(boxCount, 0), 3);
  
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Погрузчик - корпус */}
      <path d="M5 17h4v-5H5z" />
      <path d="M5 12V9c0-1 .5-2 2-2h2" />
      
      {/* Кабина водителя */}
      <circle cx="6.5" cy="19" r="1.5" />
      <circle cx="11" cy="19" r="1.5" />
      <path d="M3 17.5h1" />
      <path d="M12.5 17.5h1" />
      
      {/* Мачта погрузчика */}
      <path d="M13 17V6" />
      <path d="M13 6h4" />
      
      {/* Вилы */}
      <path d="M17 6v2h3v1h-3" />
      
      {/* Коробки на вилах - появляются в зависимости от количества заказов */}
      {boxes >= 1 && (
        <rect x="15" y="6" width="4" height="3" rx="0.3" className="fill-current opacity-30" />
      )}
      {boxes >= 2 && (
        <rect x="15.5" y="3" width="3.5" height="3" rx="0.3" className="fill-current opacity-50" />
      )}
      {boxes >= 3 && (
        <rect x="16" y="0.5" width="3" height="2.5" rx="0.3" className="fill-current opacity-70" />
      )}
    </svg>
  );
}
