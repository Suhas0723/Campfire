import { useEffect, useState } from 'react';

const NARROW = '(max-width: 767px)';
const SHORT = '(max-height: 499px)';
const PHONE_LAND = '(max-width: 932px)';

function read() {
  if (typeof window === 'undefined') return { mobile: false, short: false };
  const narrow = window.matchMedia(NARROW).matches;
  const short = window.matchMedia(SHORT).matches;
  const phoneLand = short && window.matchMedia(PHONE_LAND).matches;
  const mobile = narrow || phoneLand;
  return { mobile, short: mobile && short };
}

export default function useIsMobile() {
  const [state, setState] = useState(read);

  useEffect(() => {
    const narrow = window.matchMedia(NARROW);
    const height = window.matchMedia(SHORT);
    const land = window.matchMedia(PHONE_LAND);
    const update = () => {
      const short = height.matches;
      const mobile = narrow.matches || (short && land.matches);
      setState({ mobile, short: mobile && short });
    };
    update();
    narrow.addEventListener('change', update);
    height.addEventListener('change', update);
    land.addEventListener('change', update);
    return () => {
      narrow.removeEventListener('change', update);
      height.removeEventListener('change', update);
      land.removeEventListener('change', update);
    };
  }, []);

  return state;
}
