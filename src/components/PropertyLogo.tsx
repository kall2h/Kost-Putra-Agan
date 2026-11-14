import React from 'react';

interface PropertyLogoProps {
  className?: string;
}

export const PropertyLogo: React.FC<PropertyLogoProps> = ({ className = 'w-9 h-9' }) => {
  return (
    <div
      className={`${className} rounded-xl bg-gradient-to-br from-[#0F766E] via-[#0D9488] to-[#0284C7] shadow-sm flex items-center justify-center shrink-0`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5 text-white"
      >
        <path
          d="M4.5 13L14 5L23.5 13"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.5 11V22.5H20.5V11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 22.5V16.5H16V22.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
