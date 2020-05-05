import { property } from 'hybrids';
import { camelToDash } from 'hybrids/src/utils';
import { getType, coerceToType, setAttr } from './utils';
import fastdom from 'fastdom';

// Keep track of any instances of any components that use reflected attributes.
const hosts = new WeakMap();

// Keep track of all reflected attributes, by component tag name.
const reflectedAttributes = new Map();

function createMutationObserver(host, tagName) {
  const observer = new MutationObserver((mutations) => {
    const watchedAttrs = reflectedAttributes.get(tagName);
    mutations.forEach(({ attributeName, target }) => {
      const watchedAttr = watchedAttrs.get(attributeName);
      if (watchedAttr) {
        const { key, type } = watchedAttr;
        const attrValue = target.getAttribute(attributeName);
        const reflectedValue = coerceToType(attrValue, type);
        if (reflectedValue != undefined && reflectedValue !== host[key]) {
          target[key] = reflectedValue;
        }
      }
    });
  });
  hosts.set(host, true);
  observer.observe(host, { attributes: true });
  return observer;
}

export default function reflect(value, methods = {}) {
  // return {
  //   get: (host, val = value) => val,
  //   set: (host, val, oldValue) => transform(val, oldValue),
  //   connect:
  //     type !== "object" && type !== "undefined"
  //       ? (host, key, invalidate) => {
  //           if (host[key] === value) {
  //             const attrName = camelToDash(key);

  //             if (host.hasAttribute(attrName)) {
  //               const attrValue = host.getAttribute(attrName);
  //               host[key] =
  //                 attrValue === "" && transform === Boolean ? true : attrValue;
  //             }
  //           }

  //           return connect && connect(host, key, invalidate);
  //         }
  //       : connect,
  // };

  let type, attrName, observer;

  function observeFn(host, key) {
    console.log(key);
    let disconnectFn;
    type = methods.type || getType(value);
    attrName = camelToDash(key);
    const tagName = host.tagName;

    // Assign all reflected attributes to a map whose lookup is the tagName.
    const attrMap = reflectedAttributes.get(tagName) || new Map();
    reflectedAttributes.set(tagName, attrMap.set(attrName, { key, type }));

    // Set coerced value for key, as derived from attribute.
    const attrValue = host.getAttribute(attrName);
    if (attrValue === null) {
      setAttr(host, attrName, type, value);
    } else {
      value = coerceToType(attrValue, type);
      if (host[key] !== value) {
        fastdom.mutate(() => {
          host[key] = value;
        });
      }
    }

    // // If the property already has the same value, do nothing.
    // if (host[key] !== value) {
    //   host[key] = value;
    // }

    if (!hosts.get(host)) {
      observer = createMutationObserver(host, tagName);
      disconnectFn = () => {
        alert('connectFn Disconnect');
        observer.disconnect();
        hosts.delete(host);
      };
    }

    return {
      value,
      disconnectFn,
    };
  }

  let initialValue;
  return {
    connect: (host, key) => {
      console.log('connect', key);
      initialValue = observeFn(host, key);
      const disconnectFn = methods.connect && methods.connect(host, key);
      // host[key] = observer.value;
      return () => {
        if (disconnectFn) disconnectFn();
        if (initialValue.disconnectFn) initialValue.disconnectFn();
      };
    },
    get: (host, val, oldValue) => {
      console.log('get');
      const reflectedVal = methods.get && methods.get(host, val, oldValue);
      return reflectedVal == undefined ? val : reflectedVal;
    },
    set: (host, val, oldValue) => {
      console.log('set', attrName);
      // debugger;
      const reflectedVal = methods.set && methods.set(host, val, oldValue);
      return reflectedVal === undefined ? type(val) : reflectedVal;
    },
    observe: (host, val, oldValue) => {
      console.log('observe');
      setAttr(host, attrName, type, val, oldValue);
      if (methods.observe) methods.observe(host, val, oldValue);
    },
  };

  const properties = {
    ...property(value),
  };

  if (methods.get) properties.get = methods.get;
  if (methods.set) properties.set = methods.set;
  if (methods.connect) properties.connect = methods.connect;

  // properties.set = (host, value, oldValue) => {
  //   const v =   methods.set ? methods.set(host, value, oldValue) : properties.set(host, value, oldValue);
  //   debugger;
  //   return v;
  // }
  // if (methods.observe) properties.observe = methods.observe;
  // properties.observe = (host, val, oldValue) => {
  //   setAttr(host, attrName, type, val, oldValue);
  //   if (methods.observe) methods.observe(host, val, oldValue);
  // }

  return {
    connect: properties.connect,
    set: properties.set,
    get: properties.get,
  };
}

// export   function reflect2(value, methods = {}) {
//   let type;
//   let attrName;
//   let observer;
//   let reflectedValue = value;
//   const properties = {
//     ...property(reflectedValue, function connect(host, key) {
//       type = methods.type || getType(reflectedValue);
//       attrName = camelToDash(key);
//       const tagName = host.tagName;

//       // Assign all reflected attributes to a map whose lookup is the tagName.
//       const attrMap = reflectedAttributes.get(tagName) || new Map();
//       reflectedAttributes.set(tagName, attrMap.set(attrName, { key, type }));

//       // Set coerced value for key, as derived from attribute.
//       const attrValue = host.getAttribute(attrName);
//       if (attrValue !== null) {
//         reflectedValue = coerceToType(attrValue, type);
//         host[key] = reflectedValue;
//       }

//       // Only assign a single mutation observer to watch any single host, no matter how many reflected keys it has.
//       const hasObserver = hosts.get(host);
//       if (!hasObserver) {
//         observer = new MutationObserver((mutations) => {
//           const watchedAttrs = reflectedAttributes.get(tagName);
//           mutations.forEach(({ attributeName, target }) => {
//             const watchedAttr = watchedAttrs.get(attributeName);
//             if (watchedAttr) {
//               const { key, type } = watchedAttr;
//               const attrValue = target.getAttribute(attributeName);
//               const reflectedValue = coerceToType(attrValue, type);
//               if (reflectedValue != undefined && reflectedValue !== host[key]) {
//                 target[key] = reflectedValue;
//               }
//             }
//           });
//         });
//         hosts.set(host, true);
//         observer.observe(host, { attributes: true });
//       }

//       // Call any individually defined `connect` method the property may have.
//       let disconnectFn;
//       if (methods.connect) {
//         disconnectFn = methods.connect(host, key);
//       }

//       // Once a host disconnects, stop watching it and remove it from WeakMap.
//       // Only run code once no matter how many reflected keys it has.
//       return () => {
//         disconnectFn && disconnectFn();
//         if (observer) {
//           observer.disconnect();
//           hosts.delete(host);
//         }
//       };
//     }),
//   };
//   const _get = properties.get;
//   properties.get = (host, val = value) => {
//     return methods.get ? methods.get(host, val) : _get(host, val);
//   };
//   const _set = properties.set;
//   properties.set = (host, val, oldValue) => {
//     return methods.set
//       ? methods.set(host, val, oldValue)
//       : _set(host, val, oldValue);
//   };
//   properties.observe = (host, val, oldValue) => {
//     setAttr(host, attrName, type, val, oldValue);
//     if (methods.observe) methods.observe(host, val, oldValue);
//   };
//   return properties;
// }

export { getType, coerceToType };
