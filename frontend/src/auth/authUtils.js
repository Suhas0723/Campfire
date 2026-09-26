export function firstName(user) {
  return (user?.name || '').trim().split(/\s+/)[0] || 'Friend';
}

// Only same-site paths are allowed as a return target, so a crafted link can't bounce users elsewhere.
export function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : '/';
}

export function maskPhone(dial, digits) {
  const last = digits.slice(-4);
  return `${dial} ••• ••• ${last}`;
}
