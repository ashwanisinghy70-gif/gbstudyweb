import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface RouterContextValue {
  pathname: string;
  search: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue>({
  pathname: '/',
  search: '',
  navigate: () => undefined,
});

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [loc, setLoc] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  }));

  useEffect(() => {
    const onPopState = () => {
      setLoc({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const url = new URL(to, window.location.origin);
    if (options?.replace) {
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } else {
      window.history.pushState({}, '', url.pathname + url.search + url.hash);
    }
    setLoc({
      pathname: url.pathname || '/',
      search: url.search || '',
    });
    window.scrollTo(0, 0);
  }, []);

  return (
    <RouterContext.Provider value={{ pathname: loc.pathname, search: loc.search, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

export function Link({ to, replace, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      rest.target === '_blank'
    ) {
      return;
    }
    e.preventDefault();
    navigate(to, { replace });
  };

  return <a href={to} onClick={handleClick} {...rest} />;
}
