const routes = {};

export function defineRoute(pattern, handler) {
  routes[pattern] = handler;
}

function matchRoute(hash) {
  const path = (hash || '').replace(/^#/, '') || '/';

  for (const pattern of Object.keys(routes)) {
    const paramNames = [];
    const regexStr = pattern.replace(/:([a-zA-Z]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const match = path.match(new RegExp(`^${regexStr}$`));

    if (match) {
      const params = {};
      paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
      return { handler: routes[pattern], params };
    }
  }

  return null;
}

export function navigate(path) {
  window.location.hash = path;
}

export function initRouter() {
  function handleRoute() {
    const matched = matchRoute(window.location.hash);
    if (matched) {
      matched.handler(matched.params);
    } else {
      navigate('/');
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
