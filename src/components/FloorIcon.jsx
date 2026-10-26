const FloorIcon = ({ size = 15, className, strokeWidth = 2, ...rest }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...rest}
    >
        <path d="M3 21h4v-5h5v-5h5V6h4" />
        <path d="M3 21h18" />
    </svg>
);

export default FloorIcon;
