// Light theme styles for Admin pages (matching Products and Messaging pages)

export const cardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' };
export const inputStyle = { background: '#F5FAF5', border: '1px solid #D1E8D1', color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };
export const labelStyle = { color: '#6B7280', fontFamily: 'Poppins, sans-serif' };
export const primaryText = { color: '#1A2B1F', fontFamily: 'Poppins, sans-serif' };
export const headingStyle = { color: '#014945', fontFamily: 'Montserrat, sans-serif' };
export const pageTitleStyle = { color: '#014945', fontFamily: 'Montserrat, sans-serif' };

// Table styles
export const tableHeaderStyle = { background: '#F5FAF5', borderBottom: '1px solid #E8F2F1' };
export const tableRowStyle = { borderBottom: '1px solid #F0F7F0' };
export const tableCellStyle = { color: '#374151', fontFamily: 'Poppins, sans-serif' };
export const tableHeaderTextStyle = { color: '#6B7280', fontFamily: 'Poppins, sans-serif' };

// Stat card styles
export const statCardStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' };
export const statCardIconBg = (color: string) => `${color}18`;

// Button styles
export const primaryButtonStyle = { background: '#014945', color: '#FFFFFF', fontFamily: 'Poppins, sans-serif' };
export const secondaryButtonStyle = { background: '#F5FAF5', color: '#6B7280', border: '1px solid #E8F2F1', fontFamily: 'Poppins, sans-serif' };

// Modal styles
export const modalStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1', boxShadow: '0 20px 60px rgba(1,73,69,0.15)' };
export const modalOverlayStyle = { background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' };

// Filter bar styles
export const filterBarStyle = { background: '#FFFFFF', border: '1px solid #E8F2F1', borderRadius: '16px' };
export const searchInputContainerStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1' };
export const selectStyle = { background: '#F5FAF5', border: '1px solid #E8F2F1', color: '#374151', fontFamily: 'Poppins, sans-serif' };

// Status badge styles (light theme)
export const statusBadgeStyle = (color: string) => ({ background: `${color}18`, color });

// Hover effects
export const tableRowHoverClass = 'hover:bg-[#F5FAF5]';
export const buttonHoverClass = 'hover:opacity-80';

// Empty state
export const emptyStateIconStyle = { color: '#D1E8D1' };
export const emptyStateTextStyle = { color: '#9CA3AF', fontFamily: 'Poppins, sans-serif' };
