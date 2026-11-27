import{a as e,t}from"./rolldown-runtime-Cyuzqnbw.js";import{g as n}from"./vendor-react-Ay93qfQX.js";import{t as r}from"./vendor-supabase-BNeR07GE.js";var i=r(void 0,void 0,{auth:{persistSession:!0,autoRefreshToken:!0,detectSessionInUrl:!0}}),a=e(n(),1);function o(e){var t,n,r=``;if(typeof e==`string`||typeof e==`number`)r+=e;else if(typeof e==`object`)if(Array.isArray(e)){var i=e.length;for(t=0;t<i;t++)e[t]&&(n=o(e[t]))&&(r&&(r+=` `),r+=n)}else for(n in e)e[n]&&(r&&(r+=` `),r+=n);return r}function s(){for(var e,t,n=0,r=``,i=arguments.length;n<i;n++)(e=arguments[n])&&(t=o(e))&&(r&&(r+=` `),r+=t);return r}var c=e=>typeof e==`number`&&!isNaN(e),l=e=>typeof e==`string`,u=e=>typeof e==`function`,d=e=>l(e)||c(e),f=e=>l(e)||u(e)?e:null,p=(e,t)=>e===!1||c(e)&&e>0?e:t,m=e=>(0,a.isValidElement)(e)||l(e)||u(e)||c(e);function h(e,t,n=300){let{scrollHeight:r,style:i}=e;requestAnimationFrame(()=>{i.minHeight=`initial`,i.height=r+`px`,i.transition=`all ${n}ms`,requestAnimationFrame(()=>{i.height=`0`,i.padding=`0`,i.margin=`0`,setTimeout(t,n)})})}function g({enter:e,exit:t,appendPosition:n=!1,collapse:r=!0,collapseDuration:i=300}){return function({children:o,position:s,preventExitTransition:c,done:l,nodeRef:u,isIn:d,playToast:f}){let p=n?`${e}--${s}`:e,m=n?`${t}--${s}`:t,g=(0,a.useRef)(0);return(0,a.useLayoutEffect)(()=>{let e=u.current,t=p.split(` `),n=r=>{r.target===u.current&&(f(),e.removeEventListener(`animationend`,n),e.removeEventListener(`animationcancel`,n),g.current===0&&r.type!==`animationcancel`&&e.classList.remove(...t))};e.classList.add(...t),e.addEventListener(`animationend`,n),e.addEventListener(`animationcancel`,n)},[]),(0,a.useEffect)(()=>{let e=u.current,t=()=>{e.removeEventListener(`animationend`,t),r?h(e,l,i):l()};d||(c?t():(g.current=1,e.className+=` ${m}`,e.addEventListener(`animationend`,t)))},[d]),a.createElement(a.Fragment,null,o)}}function _(e,t){return{content:v(e.content,e.props),containerId:e.props.containerId,id:e.props.toastId,theme:e.props.theme,type:e.props.type,data:e.props.data||{},isLoading:e.props.isLoading,icon:e.props.icon,reason:e.removalReason,status:t}}function v(e,t,n=!1){return(0,a.isValidElement)(e)&&!l(e.type)?(0,a.cloneElement)(e,{closeToast:t.closeToast,toastProps:t,data:t.data,isPaused:n}):u(e)?e({closeToast:t.closeToast,toastProps:t,data:t.data,isPaused:n}):e}function y({closeToast:e,theme:t,ariaLabel:n=`close`}){return a.createElement(`button`,{className:`Toastify__close-button Toastify__close-button--${t}`,type:`button`,onClick:t=>{t.stopPropagation(),e(!0)},"aria-label":n},a.createElement(`svg`,{"aria-hidden":`true`,viewBox:`0 0 14 16`},a.createElement(`path`,{fillRule:`evenodd`,d:`M7.71 8.23l3.75 3.75-1.48 1.48-3.75-3.75-3.75 3.75L1 11.98l3.75-3.75L1 4.48 2.48 3l3.75 3.75L9.98 3l1.48 1.48-3.75 3.75z`})))}function b({delay:e,isRunning:t,closeToast:n,type:r=`default`,hide:i,className:o,controlledProgress:c,progress:l,rtl:d,isIn:f,theme:p}){let m=i||c&&l===0,h={animationDuration:`${e}ms`,animationPlayState:t?`running`:`paused`};c&&(h.transform=`scaleX(${l})`);let g=s(`Toastify__progress-bar`,c?`Toastify__progress-bar--controlled`:`Toastify__progress-bar--animated`,`Toastify__progress-bar-theme--${p}`,`Toastify__progress-bar--${r}`,{"Toastify__progress-bar--rtl":d}),_=u(o)?o({rtl:d,type:r,defaultClassName:g}):s(g,o),v={[c&&l>=1?`onTransitionEnd`:`onAnimationEnd`]:c&&l<1?null:()=>{f&&n()}};return a.createElement(`div`,{className:`Toastify__progress-bar--wrp`,"data-hidden":m},a.createElement(`div`,{className:`Toastify__progress-bar--bg Toastify__progress-bar-theme--${p} Toastify__progress-bar--${r}`}),a.createElement(`div`,{role:`progressbar`,"aria-hidden":m?`true`:`false`,"aria-label":`notification timer`,"aria-valuenow":c?Math.round(l*100):void 0,"aria-valuemin":0,"aria-valuemax":100,className:_,style:h,...v}))}var x=1,S=()=>`${x++}`;function C(e,t,n){let r=1,i=0,a=[],o=[],s=t,l=new Map,u=new Set,d=e=>(u.add(e),()=>u.delete(e)),h=()=>{o=Array.from(l.values()),u.forEach(e=>e())},g=({containerId:t,toastId:n,updateId:r})=>{let i=t?t!==e:e!==1,a=l.has(n)&&r==null;return i||a},v=(e,t)=>{l.forEach(n=>{var r;(t==null||t===n.props.toastId)&&((r=n.toggle)==null||r.call(n,e))})},y=e=>{var t,r;e.isActive&&((r=(t=e.props)?.onClose)==null||r.call(t,e.removalReason),e.isActive=!1,n(_(e,`removed`)))},b=e=>{if(e==null)l.forEach(y);else{let t=l.get(e);t&&y(t)}h()},x=()=>{i-=a.length,a=[]},S=e=>{var t,r;let{toastId:i,updateId:a}=e.props,o=a==null;e.staleId&&l.delete(e.staleId),e.isActive=!0,l.set(i,e),h(),n(_(e,o?`added`:`updated`)),o&&((r=(t=e.props).onOpen)==null||r.call(t))};return{id:e,props:s,observe:d,toggle:v,removeToast:b,toasts:l,clearQueue:x,buildToast:(e,t)=>{if(g(t))return;let{toastId:n,updateId:o,data:u,staleId:d,delay:_}=t,v=o==null;v&&i++;let y={...s,style:s.toastStyle,key:r++,...Object.fromEntries(Object.entries(t).filter(([e,t])=>t!=null)),toastId:n,updateId:o,data:u,isIn:!1,className:f(t.className||s.toastClassName),progressClassName:f(t.progressClassName||s.progressClassName),autoClose:t.isLoading?!1:p(t.autoClose,s.autoClose),closeToast(e){let t=l.get(n);t&&(t.removalReason=e,b(n))},deleteToast(){if(l.get(n)!=null){if(l.delete(n),i--,i<0&&(i=0),a.length>0){S(a.shift());return}h()}}};y.closeButton=s.closeButton,t.closeButton===!1||m(t.closeButton)?y.closeButton=t.closeButton:t.closeButton===!0&&(y.closeButton=m(s.closeButton)?s.closeButton:!0);let x={content:e,props:y,staleId:d};s.limit&&s.limit>0&&i>s.limit&&v?a.push(x):c(_)?setTimeout(()=>{S(x)},_):S(x)},setProps(e){s=e},setToggle:(e,t)=>{let n=l.get(e);n&&(n.toggle=t)},isToastActive:e=>l.get(e)?.isActive,getSnapshot:()=>o}}var w=new Map,T=[],E=new Set,D=e=>E.forEach(t=>t(e)),O=()=>w.size>0;function k(){T.forEach(e=>P(e.content,e.options)),T=[]}var A=(e,{containerId:t})=>w.get(t||1)?.toasts.get(e);function j(e,t){var n;if(t)return!!((n=w.get(t))!=null&&n.isToastActive(e));let r=!1;return w.forEach(t=>{t.isToastActive(e)&&(r=!0)}),r}function M(e){if(!O()){T=T.filter(t=>e!=null&&t.options.toastId!==e);return}if(e==null||d(e))w.forEach(t=>{t.removeToast(e)});else if(e&&(`containerId`in e||`id`in e)){let t=w.get(e.containerId);t?t.removeToast(e.id):w.forEach(t=>{t.removeToast(e.id)})}}var N=(e={})=>{w.forEach(t=>{t.props.limit&&(!e.containerId||t.id===e.containerId)&&t.clearQueue()})};function P(e,t){m(e)&&(O()||T.push({content:e,options:t}),w.forEach(n=>{n.buildToast(e,t)}))}function F(e){var t;(t=w.get(e.containerId||1))==null||t.setToggle(e.id,e.fn)}function I(e,t){w.forEach(n=>{(t==null||!(t!=null&&t.containerId)||t?.containerId===n.id)&&n.toggle(e,t?.id)})}function L(e){let t=e.containerId||1;return{subscribe(n){let r=C(t,e,D);w.set(t,r);let i=r.observe(n);return k(),()=>{i(),w.delete(t)}},setProps(e){var n;(n=w.get(t))==null||n.setProps(e)},getSnapshot(){return w.get(t)?.getSnapshot()}}}function R(e){return E.add(e),()=>{E.delete(e)}}function z(e){return e&&(l(e.toastId)||c(e.toastId))?e.toastId:S()}function B(e,t){return P(e,t),t.toastId}function V(e,t){return{...t,type:t&&t.type||e,toastId:z(t)}}function H(e){return(t,n)=>B(t,V(e,n))}function U(e,t){return B(e,V(`default`,t))}U.loading=(e,t)=>B(e,V(`default`,{isLoading:!0,autoClose:!1,closeOnClick:!1,closeButton:!1,draggable:!1,...t}));function ee(e,{pending:t,error:n,success:r},i){let a;t&&(a=l(t)?U.loading(t,i):U.loading(t.render,{...i,...t}));let o={isLoading:null,autoClose:null,closeOnClick:null,closeButton:null,draggable:null},s=(e,t,n)=>{if(t==null){U.dismiss(a);return}let r={type:e,...o,...i,data:n},s=l(t)?{render:t}:t;return a?U.update(a,{...r,...s}):U(s.render,{...r,...s}),n},c=u(e)?e():e;return c.then(e=>s(`success`,r,e)).catch(e=>s(`error`,n,e)),c}U.promise=ee,U.success=H(`success`),U.info=H(`info`),U.error=H(`error`),U.warning=H(`warning`),U.warn=U.warning,U.dark=(e,t)=>B(e,V(`default`,{theme:`dark`,...t}));function te(e){M(e)}U.dismiss=te,U.clearWaitingQueue=N,U.isActive=j,U.update=(e,t={})=>{let n=A(e,t);if(n){let{props:r,content:i}=n,a={delay:100,...r,...t,toastId:t.toastId||e,updateId:S()};a.toastId!==e&&(a.staleId=e);let o=a.render||i;delete a.render,B(o,a)}},U.done=e=>{U.update(e,{progress:1})},U.onChange=R,U.play=e=>I(!0,e),U.pause=e=>I(!1,e);function ne(e){let{subscribe:t,getSnapshot:n,setProps:r}=(0,a.useRef)(L(e)).current;r(e);let i=(0,a.useSyncExternalStore)(t,n,n)?.slice();function o(t){if(!i)return[];let n=new Map;return e.newestOnTop&&i.reverse(),i.forEach(e=>{let{position:t}=e.props;n.has(t)||n.set(t,[]),n.get(t).push(e)}),Array.from(n,e=>t(e[0],e[1]))}return{getToastToRender:o,isToastActive:j,count:i?.length}}function re(e){let[t,n]=(0,a.useState)(!1),[r,i]=(0,a.useState)(!1),o=(0,a.useRef)(null),s=(0,a.useRef)({start:0,delta:0,removalDistance:0,canCloseOnClick:!0,canDrag:!1,didMove:!1}).current,{autoClose:c,pauseOnHover:l,closeToast:u,onClick:d,closeOnClick:f}=e;F({id:e.toastId,containerId:e.containerId,fn:n}),(0,a.useEffect)(()=>{if(e.pauseOnFocusLoss)return p(),()=>{m()}},[e.pauseOnFocusLoss]);function p(){document.hasFocus()||v(),window.addEventListener(`focus`,_),window.addEventListener(`blur`,v)}function m(){window.removeEventListener(`focus`,_),window.removeEventListener(`blur`,v)}function h(t){if(e.draggable===!0||e.draggable===t.pointerType){y();let n=o.current;s.canCloseOnClick=!0,s.canDrag=!0,n.style.transition=`none`,e.draggableDirection===`x`?(s.start=t.clientX,s.removalDistance=n.offsetWidth*(e.draggablePercent/100)):(s.start=t.clientY,s.removalDistance=n.offsetHeight*(e.draggablePercent===80?e.draggablePercent*1.5:e.draggablePercent)/100)}}function g(t){let{top:n,bottom:r,left:i,right:a}=o.current.getBoundingClientRect();t.pointerType===`mouse`&&e.pauseOnHover&&t.clientX>=i&&t.clientX<=a&&t.clientY>=n&&t.clientY<=r?v():_()}function _(){n(!0)}function v(){n(!1)}function y(){s.didMove=!1,document.addEventListener(`pointermove`,x),document.addEventListener(`pointerup`,S)}function b(){document.removeEventListener(`pointermove`,x),document.removeEventListener(`pointerup`,S)}function x(n){let r=o.current;if(s.canDrag&&r){s.didMove=!0,t&&v(),e.draggableDirection===`x`?s.delta=n.clientX-s.start:s.delta=n.clientY-s.start,s.start!==n.clientX&&(s.canCloseOnClick=!1);let i=e.draggableDirection===`x`?`${s.delta}px, var(--y)`:`0, calc(${s.delta}px + var(--y))`;r.style.transform=`translate3d(${i},0)`,r.style.opacity=`${1-Math.abs(s.delta/s.removalDistance)}`}}function S(){b();let t=o.current;if(s.canDrag&&s.didMove&&t){if(s.canDrag=!1,Math.abs(s.delta)>s.removalDistance){i(!0),e.closeToast(!0),e.collapseAll();return}t.style.transition=`transform 0.2s, opacity 0.2s`,t.style.removeProperty(`transform`),t.style.removeProperty(`opacity`)}}let C={onPointerDown:h,onPointerUp:g};return c&&l&&(C.onMouseEnter=v,e.stacked||(C.onMouseLeave=_)),f&&(C.onClick=e=>{d&&d(e),s.canCloseOnClick&&u(!0)}),{playToast:_,pauseToast:v,isRunning:t,preventExitTransition:r,toastRef:o,eventHandlers:C}}var W=typeof window<`u`?a.useLayoutEffect:a.useEffect,G=({theme:e,type:t,isLoading:n,...r})=>a.createElement(`svg`,{viewBox:`0 0 24 24`,width:`100%`,height:`100%`,fill:e===`colored`?`currentColor`:`var(--toastify-icon-color-${t})`,...r});function ie(e){return a.createElement(G,{...e},a.createElement(`path`,{d:`M23.32 17.191L15.438 2.184C14.728.833 13.416 0 11.996 0c-1.42 0-2.733.833-3.443 2.184L.533 17.448a4.744 4.744 0 000 4.368C1.243 23.167 2.555 24 3.975 24h16.05C22.22 24 24 22.044 24 19.632c0-.904-.251-1.746-.68-2.44zm-9.622 1.46c0 1.033-.724 1.823-1.698 1.823s-1.698-.79-1.698-1.822v-.043c0-1.028.724-1.822 1.698-1.822s1.698.79 1.698 1.822v.043zm.039-12.285l-.84 8.06c-.057.581-.408.943-.897.943-.49 0-.84-.367-.896-.942l-.84-8.065c-.057-.624.25-1.095.779-1.095h1.91c.528.005.84.476.784 1.1z`}))}function ae(e){return a.createElement(G,{...e},a.createElement(`path`,{d:`M12 0a12 12 0 1012 12A12.013 12.013 0 0012 0zm.25 5a1.5 1.5 0 11-1.5 1.5 1.5 1.5 0 011.5-1.5zm2.25 13.5h-4a1 1 0 010-2h.75a.25.25 0 00.25-.25v-4.5a.25.25 0 00-.25-.25h-.75a1 1 0 010-2h1a2 2 0 012 2v4.75a.25.25 0 00.25.25h.75a1 1 0 110 2z`}))}function oe(e){return a.createElement(G,{...e},a.createElement(`path`,{d:`M12 0a12 12 0 1012 12A12.014 12.014 0 0012 0zm6.927 8.2l-6.845 9.289a1.011 1.011 0 01-1.43.188l-4.888-3.908a1 1 0 111.25-1.562l4.076 3.261 6.227-8.451a1 1 0 111.61 1.183z`}))}function se(e){return a.createElement(G,{...e},a.createElement(`path`,{d:`M11.983 0a12.206 12.206 0 00-8.51 3.653A11.8 11.8 0 000 12.207 11.779 11.779 0 0011.8 24h.214A12.111 12.111 0 0024 11.791 11.766 11.766 0 0011.983 0zM10.5 16.542a1.476 1.476 0 011.449-1.53h.027a1.527 1.527 0 011.523 1.47 1.475 1.475 0 01-1.449 1.53h-.027a1.529 1.529 0 01-1.523-1.47zM11 12.5v-6a1 1 0 012 0v6a1 1 0 11-2 0z`}))}function ce(){return a.createElement(`div`,{className:`Toastify__spinner`})}var K={info:ae,warning:ie,success:oe,error:se,spinner:ce},le=e=>e in K;function ue({theme:e,type:t,isLoading:n,icon:r}){let i=null,o={theme:e,type:t};return r===!1||(u(r)?i=r({...o,isLoading:n}):(0,a.isValidElement)(r)?i=(0,a.cloneElement)(r,o):n?i=K.spinner():le(t)&&(i=K[t](o))),i}var de=e=>{let{isRunning:t,preventExitTransition:n,toastRef:r,eventHandlers:i,playToast:o}=re(e),{closeButton:c,children:l,autoClose:d,onClick:f,type:p,hideProgressBar:m,closeToast:h,transition:g,position:_,className:x,style:S,progressClassName:C,updateId:w,role:T,progress:E,rtl:D,toastId:O,deleteToast:k,isIn:A,isLoading:j,closeOnClick:M,theme:N,ariaLabel:P}=e,F=s(`Toastify__toast`,`Toastify__toast-theme--${N}`,`Toastify__toast--${p}`,{"Toastify__toast--rtl":D},{"Toastify__toast--close-on-click":M}),I=u(x)?x({rtl:D,position:_,type:p,defaultClassName:F}):s(F,x),L=ue(e),R=!!E||!d,z={closeToast:h,type:p,theme:N},B=null;return c===!1||(B=u(c)?c(z):(0,a.isValidElement)(c)?(0,a.cloneElement)(c,z):y(z)),a.createElement(g,{isIn:A,done:k,position:_,preventExitTransition:n,nodeRef:r,playToast:o},a.createElement(`div`,{id:O,tabIndex:0,onClick:f,"data-in":A,className:I,...i,style:S,ref:r,...A&&{role:T,"aria-label":P}},L!=null&&a.createElement(`div`,{className:s(`Toastify__toast-icon`,{"Toastify--animate-icon Toastify__zoom-enter":!j})},L),v(l,e,!t),B,!e.customProgressBar&&a.createElement(b,{...w&&!R?{key:`p-${w}`}:{},rtl:D,theme:N,delay:d,isRunning:t,isIn:A,closeToast:h,hide:m,type:p,className:C,controlledProgress:R,progress:E||0})))},q=(e,t=!1)=>({enter:`Toastify--animate Toastify__${e}-enter`,exit:`Toastify--animate Toastify__${e}-exit`,appendPosition:t}),fe=g(q(`bounce`,!0));g(q(`slide`,!0)),g(q(`zoom`)),g(q(`flip`));var pe={position:`top-right`,transition:fe,autoClose:5e3,closeButton:!0,pauseOnHover:!0,pauseOnFocusLoss:!0,draggable:`touch`,draggablePercent:80,draggableDirection:`x`,role:`alert`,theme:`light`,"aria-label":`Notifications Alt+T`,hotKeys:e=>e.altKey&&e.code===`KeyT`};function me(e){let t={...pe,...e},n=e.stacked,[r,i]=(0,a.useState)(!0),o=(0,a.useRef)(null),{getToastToRender:c,isToastActive:l,count:d}=ne(t),{className:p,style:m,rtl:h,containerId:g,hotKeys:_}=t;function v(e){let t=s(`Toastify__toast-container`,`Toastify__toast-container--${e}`,{"Toastify__toast-container--rtl":h});return u(p)?p({position:e,rtl:h,defaultClassName:t}):s(t,f(p))}function y(){n&&(i(!0),U.play())}return W(()=>{if(n){let e=o.current.querySelectorAll(`[data-in="true"]`),n=t.position?.includes(`top`),i=0,a=0;Array.from(e).reverse().forEach((e,t)=>{let o=e;o.classList.add(`Toastify__toast--stacked`),t>0&&(o.dataset.collapsed=`${r}`),o.dataset.pos||(o.dataset.pos=n?`top`:`bot`);let s=i*(r?.2:1)+(r?0:12*t),c=Math.max(.5,1-(r?a:0));o.style.setProperty(`--y`,`${n?s:s*-1}px`),o.style.setProperty(`--g`,`12`),o.style.setProperty(`--s`,`${c}`),i+=o.offsetHeight,a+=.025})}},[r,d,n]),(0,a.useEffect)(()=>{function e(e){var t;let n=o.current;_(e)&&((t=n?.querySelector(`[tabIndex="0"]`))==null||t.focus(),i(!1),U.pause()),e.key===`Escape`&&(document.activeElement===n||n!=null&&n.contains(document.activeElement))&&(i(!0),U.play())}return document.addEventListener(`keydown`,e),()=>{document.removeEventListener(`keydown`,e)}},[_]),a.createElement(`section`,{ref:o,className:`Toastify`,id:g,onMouseEnter:()=>{n&&(i(!1),U.pause())},onMouseLeave:y,"aria-live":`polite`,"aria-atomic":`false`,"aria-relevant":`additions text`,"aria-label":t[`aria-label`]},c((e,t)=>{let r=t.length?{...m}:{...m,pointerEvents:`none`};return a.createElement(`div`,{tabIndex:-1,className:v(e),"data-stacked":n,style:r,key:`c-${e}`},t.map(({content:e,props:t})=>a.createElement(de,{...t,stacked:n,collapseAll:y,isIn:l(t.toastId,t.containerId),key:`t-${t.key}`},e)))}))}var he=`:root {
  --toastify-color-light: #fff;
  --toastify-color-dark: #121212;
  --toastify-color-info: #3498db;
  --toastify-color-success: #07bc0c;
  --toastify-color-warning: #f1c40f;
  --toastify-color-error: hsl(6, 78%, 57%);
  --toastify-color-transparent: rgba(255, 255, 255, 0.7);

  --toastify-icon-color-info: var(--toastify-color-info);
  --toastify-icon-color-success: var(--toastify-color-success);
  --toastify-icon-color-warning: var(--toastify-color-warning);
  --toastify-icon-color-error: var(--toastify-color-error);

  --toastify-container-width: fit-content;
  --toastify-toast-width: 320px;
  --toastify-toast-offset: 16px;
  --toastify-toast-top: max(var(--toastify-toast-offset), env(safe-area-inset-top));
  --toastify-toast-right: max(var(--toastify-toast-offset), env(safe-area-inset-right));
  --toastify-toast-left: max(var(--toastify-toast-offset), env(safe-area-inset-left));
  --toastify-toast-bottom: max(var(--toastify-toast-offset), env(safe-area-inset-bottom));
  --toastify-toast-background: #fff;
  --toastify-toast-padding: 14px;
  --toastify-toast-min-height: 64px;
  --toastify-toast-max-height: 800px;
  --toastify-toast-bd-radius: 6px;
  --toastify-toast-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
  --toastify-font-family: sans-serif;
  --toastify-z-index: 9999;
  --toastify-text-color-light: #757575;
  --toastify-text-color-dark: #fff;

  /* Used only for colored theme */
  --toastify-text-color-info: #fff;
  --toastify-text-color-success: #fff;
  --toastify-text-color-warning: #fff;
  --toastify-text-color-error: #fff;

  --toastify-spinner-color: #616161;
  --toastify-spinner-color-empty-area: #e0e0e0;
  --toastify-color-progress-light: linear-gradient(to right, #4cd964, #5ac8fa, #007aff, #34aadc, #5856d6, #ff2d55);
  --toastify-color-progress-dark: #bb86fc;
  --toastify-color-progress-info: var(--toastify-color-info);
  --toastify-color-progress-success: var(--toastify-color-success);
  --toastify-color-progress-warning: var(--toastify-color-warning);
  --toastify-color-progress-error: var(--toastify-color-error);
  /* used to control the opacity of the progress trail */
  --toastify-color-progress-bgo: 0.2;
}

.Toastify__toast-container {
  z-index: var(--toastify-z-index);
  -webkit-transform: translate3d(0, 0, var(--toastify-z-index));
  position: fixed;
  width: var(--toastify-container-width);
  box-sizing: border-box;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.Toastify__toast-container--top-left {
  top: var(--toastify-toast-top);
  left: var(--toastify-toast-left);
}
.Toastify__toast-container--top-center {
  top: var(--toastify-toast-top);
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}
.Toastify__toast-container--top-right {
  top: var(--toastify-toast-top);
  right: var(--toastify-toast-right);
  align-items: end;
}
.Toastify__toast-container--bottom-left {
  bottom: var(--toastify-toast-bottom);
  left: var(--toastify-toast-left);
}
.Toastify__toast-container--bottom-center {
  bottom: var(--toastify-toast-bottom);
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}
.Toastify__toast-container--bottom-right {
  bottom: var(--toastify-toast-bottom);
  right: var(--toastify-toast-right);
  align-items: end;
}

.Toastify__toast {
  --y: 0px;
  position: relative;
  touch-action: none;
  width: var(--toastify-toast-width);
  min-height: var(--toastify-toast-min-height);
  box-sizing: border-box;
  margin-bottom: 1rem;
  padding: var(--toastify-toast-padding);
  border-radius: var(--toastify-toast-bd-radius);
  box-shadow: var(--toastify-toast-shadow);
  max-height: var(--toastify-toast-max-height);
  font-family: var(--toastify-font-family);
  /* webkit only issue #791 */
  z-index: 0;
  /* inner swag */
  display: flex;
  flex: 1 auto;
  align-items: center;
  word-break: break-word;
}

@media only screen and (max-width: 480px) {
  .Toastify__toast-container {
    width: 100vw;
    left: env(safe-area-inset-left);
    margin: 0;
  }
  .Toastify__toast-container--top-left,
  .Toastify__toast-container--top-center,
  .Toastify__toast-container--top-right {
    top: env(safe-area-inset-top);
    transform: translateX(0);
  }
  .Toastify__toast-container--bottom-left,
  .Toastify__toast-container--bottom-center,
  .Toastify__toast-container--bottom-right {
    bottom: env(safe-area-inset-bottom);
    transform: translateX(0);
  }
  .Toastify__toast-container--rtl {
    right: env(safe-area-inset-right);
    left: initial;
  }
  .Toastify__toast {
    --toastify-toast-width: 100%;
    margin-bottom: 0;
    border-radius: 0;
  }
}

.Toastify__toast-container[data-stacked='true'] {
  width: var(--toastify-toast-width);
}

@media only screen and (max-width: 480px) {
  .Toastify__toast-container[data-stacked='true'] {
    width: 100vw;
  }
}

.Toastify__toast--stacked {
  position: absolute;
  width: 100%;
  transform: translate3d(0, var(--y), 0) scale(var(--s));
  transition: transform 0.3s;
}

.Toastify__toast--stacked[data-collapsed] .Toastify__toast-body,
.Toastify__toast--stacked[data-collapsed] .Toastify__close-button {
  transition: opacity 0.1s;
}

.Toastify__toast--stacked[data-collapsed='false'] {
  overflow: visible;
}

.Toastify__toast--stacked[data-collapsed='true']:not(:last-child) > * {
  opacity: 0;
}

.Toastify__toast--stacked:after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: calc(var(--g) * 1px);
  bottom: 100%;
}

.Toastify__toast--stacked[data-pos='top'] {
  top: 0;
}

.Toastify__toast--stacked[data-pos='bot'] {
  bottom: 0;
}

.Toastify__toast--stacked[data-pos='bot'].Toastify__toast--stacked:before {
  transform-origin: top;
}

.Toastify__toast--stacked[data-pos='top'].Toastify__toast--stacked:before {
  transform-origin: bottom;
}

.Toastify__toast--stacked:before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  transform: scaleY(3);
  z-index: -1;
}

.Toastify__toast--rtl {
  direction: rtl;
}

.Toastify__toast--close-on-click {
  cursor: pointer;
}

.Toastify__toast-icon {
  margin-inline-end: 10px;
  width: 22px;
  flex-shrink: 0;
  display: flex;
}

.Toastify--animate {
  animation-fill-mode: both;
  animation-duration: 0.5s;
}

.Toastify--animate-icon {
  animation-fill-mode: both;
  animation-duration: 0.3s;
}

.Toastify__toast-theme--dark {
  background: var(--toastify-color-dark);
  color: var(--toastify-text-color-dark);
}

.Toastify__toast-theme--light {
  background: var(--toastify-color-light);
  color: var(--toastify-text-color-light);
}

.Toastify__toast-theme--colored.Toastify__toast--default {
  background: var(--toastify-color-light);
  color: var(--toastify-text-color-light);
}

.Toastify__toast-theme--colored.Toastify__toast--info {
  color: var(--toastify-text-color-info);
  background: var(--toastify-color-info);
}

.Toastify__toast-theme--colored.Toastify__toast--success {
  color: var(--toastify-text-color-success);
  background: var(--toastify-color-success);
}

.Toastify__toast-theme--colored.Toastify__toast--warning {
  color: var(--toastify-text-color-warning);
  background: var(--toastify-color-warning);
}

.Toastify__toast-theme--colored.Toastify__toast--error {
  color: var(--toastify-text-color-error);
  background: var(--toastify-color-error);
}

.Toastify__progress-bar-theme--light {
  background: var(--toastify-color-progress-light);
}

.Toastify__progress-bar-theme--dark {
  background: var(--toastify-color-progress-dark);
}

.Toastify__progress-bar--info {
  background: var(--toastify-color-progress-info);
}

.Toastify__progress-bar--success {
  background: var(--toastify-color-progress-success);
}

.Toastify__progress-bar--warning {
  background: var(--toastify-color-progress-warning);
}

.Toastify__progress-bar--error {
  background: var(--toastify-color-progress-error);
}

.Toastify__progress-bar-theme--colored.Toastify__progress-bar--info,
.Toastify__progress-bar-theme--colored.Toastify__progress-bar--success,
.Toastify__progress-bar-theme--colored.Toastify__progress-bar--warning,
.Toastify__progress-bar-theme--colored.Toastify__progress-bar--error {
  background: var(--toastify-color-transparent);
}

.Toastify__close-button {
  color: #fff;
  position: absolute;
  top: 6px;
  right: 6px;
  background: transparent;
  outline: none;
  border: none;
  padding: 0;
  cursor: pointer;
  opacity: 0.7;
  transition: 0.3s ease;
  z-index: 1;
}

.Toastify__toast--rtl .Toastify__close-button {
  left: 6px;
  right: unset;
}

.Toastify__close-button--light {
  color: #000;
  opacity: 0.3;
}

.Toastify__close-button > svg {
  fill: currentColor;
  height: 16px;
  width: 14px;
}

.Toastify__close-button:hover,
.Toastify__close-button:focus {
  opacity: 1;
}

@keyframes Toastify__trackProgress {
  0% {
    transform: scaleX(1);
  }
  100% {
    transform: scaleX(0);
  }
}

.Toastify__progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  opacity: 0.7;
  transform-origin: left;
}

.Toastify__progress-bar--animated {
  animation: Toastify__trackProgress linear 1 forwards;
}

.Toastify__progress-bar--controlled {
  transition: transform 0.2s;
}

.Toastify__progress-bar--rtl {
  right: 0;
  left: initial;
  transform-origin: right;
  border-bottom-left-radius: initial;
}

.Toastify__progress-bar--wrp {
  position: absolute;
  overflow: hidden;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 5px;
  border-bottom-left-radius: var(--toastify-toast-bd-radius);
  border-bottom-right-radius: var(--toastify-toast-bd-radius);
}

.Toastify__progress-bar--wrp[data-hidden='true'] {
  opacity: 0;
}

.Toastify__progress-bar--bg {
  opacity: var(--toastify-color-progress-bgo);
  width: 100%;
  height: 100%;
}

.Toastify__spinner {
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: var(--toastify-spinner-color-empty-area);
  border-right-color: var(--toastify-spinner-color);
  animation: Toastify__spin 0.65s linear infinite;
}

@keyframes Toastify__bounceInRight {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  from {
    opacity: 0;
    transform: translate3d(3000px, 0, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(-25px, 0, 0);
  }
  75% {
    transform: translate3d(10px, 0, 0);
  }
  90% {
    transform: translate3d(-5px, 0, 0);
  }
  to {
    transform: none;
  }
}

@keyframes Toastify__bounceOutRight {
  20% {
    opacity: 1;
    transform: translate3d(-20px, var(--y), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(2000px, var(--y), 0);
  }
}

@keyframes Toastify__bounceInLeft {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  0% {
    opacity: 0;
    transform: translate3d(-3000px, 0, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(25px, 0, 0);
  }
  75% {
    transform: translate3d(-10px, 0, 0);
  }
  90% {
    transform: translate3d(5px, 0, 0);
  }
  to {
    transform: none;
  }
}

@keyframes Toastify__bounceOutLeft {
  20% {
    opacity: 1;
    transform: translate3d(20px, var(--y), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(-2000px, var(--y), 0);
  }
}

@keyframes Toastify__bounceInUp {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  from {
    opacity: 0;
    transform: translate3d(0, 3000px, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(0, -20px, 0);
  }
  75% {
    transform: translate3d(0, 10px, 0);
  }
  90% {
    transform: translate3d(0, -5px, 0);
  }
  to {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes Toastify__bounceOutUp {
  20% {
    transform: translate3d(0, calc(var(--y) - 10px), 0);
  }
  40%,
  45% {
    opacity: 1;
    transform: translate3d(0, calc(var(--y) + 20px), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(0, -2000px, 0);
  }
}

@keyframes Toastify__bounceInDown {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  0% {
    opacity: 0;
    transform: translate3d(0, -3000px, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(0, 25px, 0);
  }
  75% {
    transform: translate3d(0, -10px, 0);
  }
  90% {
    transform: translate3d(0, 5px, 0);
  }
  to {
    transform: none;
  }
}

@keyframes Toastify__bounceOutDown {
  20% {
    transform: translate3d(0, calc(var(--y) - 10px), 0);
  }
  40%,
  45% {
    opacity: 1;
    transform: translate3d(0, calc(var(--y) + 20px), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(0, 2000px, 0);
  }
}

.Toastify__bounce-enter--top-left,
.Toastify__bounce-enter--bottom-left {
  animation-name: Toastify__bounceInLeft;
}

.Toastify__bounce-enter--top-right,
.Toastify__bounce-enter--bottom-right {
  animation-name: Toastify__bounceInRight;
}

.Toastify__bounce-enter--top-center {
  animation-name: Toastify__bounceInDown;
}

.Toastify__bounce-enter--bottom-center {
  animation-name: Toastify__bounceInUp;
}

.Toastify__bounce-exit--top-left,
.Toastify__bounce-exit--bottom-left {
  animation-name: Toastify__bounceOutLeft;
}

.Toastify__bounce-exit--top-right,
.Toastify__bounce-exit--bottom-right {
  animation-name: Toastify__bounceOutRight;
}

.Toastify__bounce-exit--top-center {
  animation-name: Toastify__bounceOutUp;
}

.Toastify__bounce-exit--bottom-center {
  animation-name: Toastify__bounceOutDown;
}

@keyframes Toastify__zoomIn {
  from {
    opacity: 0;
    transform: scale3d(0.3, 0.3, 0.3);
  }
  50% {
    opacity: 1;
  }
}

@keyframes Toastify__zoomOut {
  from {
    opacity: 1;
  }
  50% {
    opacity: 0;
    transform: translate3d(0, var(--y), 0) scale3d(0.3, 0.3, 0.3);
  }
  to {
    opacity: 0;
  }
}

.Toastify__zoom-enter {
  animation-name: Toastify__zoomIn;
}

.Toastify__zoom-exit {
  animation-name: Toastify__zoomOut;
}

@keyframes Toastify__flipIn {
  from {
    transform: perspective(400px) rotate3d(1, 0, 0, 90deg);
    animation-timing-function: ease-in;
    opacity: 0;
  }
  40% {
    transform: perspective(400px) rotate3d(1, 0, 0, -20deg);
    animation-timing-function: ease-in;
  }
  60% {
    transform: perspective(400px) rotate3d(1, 0, 0, 10deg);
    opacity: 1;
  }
  80% {
    transform: perspective(400px) rotate3d(1, 0, 0, -5deg);
  }
  to {
    transform: perspective(400px);
  }
}

@keyframes Toastify__flipOut {
  from {
    transform: translate3d(0, var(--y), 0) perspective(400px);
  }
  30% {
    transform: translate3d(0, var(--y), 0) perspective(400px) rotate3d(1, 0, 0, -20deg);
    opacity: 1;
  }
  to {
    transform: translate3d(0, var(--y), 0) perspective(400px) rotate3d(1, 0, 0, 90deg);
    opacity: 0;
  }
}

.Toastify__flip-enter {
  animation-name: Toastify__flipIn;
}

.Toastify__flip-exit {
  animation-name: Toastify__flipOut;
}

@keyframes Toastify__slideInRight {
  from {
    transform: translate3d(110%, 0, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideInLeft {
  from {
    transform: translate3d(-110%, 0, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideInUp {
  from {
    transform: translate3d(0, 110%, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideInDown {
  from {
    transform: translate3d(0, -110%, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideOutRight {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(110%, var(--y), 0);
  }
}

@keyframes Toastify__slideOutLeft {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(-110%, var(--y), 0);
  }
}

@keyframes Toastify__slideOutDown {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(0, 500px, 0);
  }
}

@keyframes Toastify__slideOutUp {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(0, -500px, 0);
  }
}

.Toastify__slide-enter--top-left,
.Toastify__slide-enter--bottom-left {
  animation-name: Toastify__slideInLeft;
}

.Toastify__slide-enter--top-right,
.Toastify__slide-enter--bottom-right {
  animation-name: Toastify__slideInRight;
}

.Toastify__slide-enter--top-center {
  animation-name: Toastify__slideInDown;
}

.Toastify__slide-enter--bottom-center {
  animation-name: Toastify__slideInUp;
}

.Toastify__slide-exit--top-left,
.Toastify__slide-exit--bottom-left {
  animation-name: Toastify__slideOutLeft;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

.Toastify__slide-exit--top-right,
.Toastify__slide-exit--bottom-right {
  animation-name: Toastify__slideOutRight;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

.Toastify__slide-exit--top-center {
  animation-name: Toastify__slideOutUp;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

.Toastify__slide-exit--bottom-center {
  animation-name: Toastify__slideOutDown;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

@keyframes Toastify__spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
`,J=new Map,ge=(e,t)=>{W(()=>{if(!e||typeof document>`u`)return;let n=document,r=J.get(n);if(r){t&&r.setAttribute(`nonce`,t);return}let i=n.createElement(`style`);i.textContent=e,t&&i.setAttribute(`nonce`,t),n.head.appendChild(i),J.set(n,i)},[t])};function _e(e){return ge(he,e.nonce),a.createElement(me,{...e})}var ve=(e,t,n,r)=>{let i=[n,{code:t,...r||{}}];if(e?.services?.logger?.forward)return e.services.logger.forward(i,`warn`,`react-i18next::`,!0);Q(i[0])&&(i[0]=`react-i18next:: ${i[0]}`),e?.services?.logger?.warn?e.services.logger.warn(...i):console?.warn&&console.warn(...i)},Y={},X=(e,t,n,r)=>{Q(n)&&Y[n]||(Q(n)&&(Y[n]=new Date),ve(e,t,n,r))},ye=(e,t)=>()=>{if(e.isInitialized)t();else{let n=()=>{setTimeout(()=>{e.off(`initialized`,n)},0),t()};e.on(`initialized`,n)}},Z=(e,t,n)=>{e.loadNamespaces(t,ye(e,n))},be=(e,t,n,r)=>{if(Q(n)&&(n=[n]),e.options.preload&&e.options.preload.indexOf(t)>-1)return Z(e,n,r);n.forEach(t=>{e.options.ns.indexOf(t)<0&&e.options.ns.push(t)}),e.loadLanguages(t,ye(e,r))},xe=(e,t,n={})=>!t.languages||!t.languages.length?(X(t,`NO_LANGUAGES`,`i18n.languages were undefined or empty`,{languages:t.languages}),!0):t.hasLoadedNamespace(e,{lng:n.lng,precheck:(t,r)=>{if(n.bindI18n&&n.bindI18n.indexOf(`languageChanging`)>-1&&t.services.backendConnector.backend&&t.isLanguageChangingTo&&!r(t.isLanguageChangingTo,e))return!1}}),Q=e=>typeof e==`string`,Se=e=>typeof e==`object`&&!!e,Ce=/&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34|nbsp|#160|copy|#169|reg|#174|hellip|#8230|#x2F|#47);/g,we={"&amp;":`&`,"&#38;":`&`,"&lt;":`<`,"&#60;":`<`,"&gt;":`>`,"&#62;":`>`,"&apos;":`'`,"&#39;":`'`,"&quot;":`"`,"&#34;":`"`,"&nbsp;":` `,"&#160;":` `,"&copy;":`©`,"&#169;":`©`,"&reg;":`®`,"&#174;":`®`,"&hellip;":`…`,"&#8230;":`…`,"&#x2F;":`/`,"&#47;":`/`},Te=e=>we[e],$={bindI18n:`languageChanged`,bindI18nStore:``,transEmptyNodeValue:``,transSupportBasicHtmlNodes:!0,transWrapTextNodes:``,transKeepBasicHtmlNodesFor:[`br`,`strong`,`i`,`p`],useSuspense:!0,unescape:e=>e.replace(Ce,Te),transDefaultProps:void 0},Ee=(e={})=>{$={...$,...e}},De=()=>$,Oe,ke=e=>{Oe=e},Ae=()=>Oe,je={type:`3rdParty`,init(e){Ee(e.options.react),ke(e)}},Me=(0,a.createContext)(),Ne=class{constructor(){this.usedNamespaces={}}addUsedNamespaces(e){e.forEach(e=>{this.usedNamespaces[e]||(this.usedNamespaces[e]=!0)})}getUsedNamespaces(){return Object.keys(this.usedNamespaces)}},Pe=t((e=>{var t=n();function r(e,t){return e===t&&(e!==0||1/e==1/t)||e!==e&&t!==t}var i=typeof Object.is==`function`?Object.is:r,a=t.useState,o=t.useEffect,s=t.useLayoutEffect,c=t.useDebugValue;function l(e,t){var n=t(),r=a({inst:{value:n,getSnapshot:t}}),i=r[0].inst,l=r[1];return s(function(){i.value=n,i.getSnapshot=t,u(i)&&l({inst:i})},[e,n,t]),o(function(){return u(i)&&l({inst:i}),e(function(){u(i)&&l({inst:i})})},[e]),c(n),n}function u(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!i(e,n)}catch{return!0}}function d(e,t){return t()}var f=typeof window>`u`||window.document===void 0||window.document.createElement===void 0?d:l;e.useSyncExternalStore=t.useSyncExternalStore===void 0?f:t.useSyncExternalStore})),Fe=t(((e,t)=>{t.exports=Pe()}))(),Ie={t:(e,t)=>{if(Q(t))return t;if(Se(t)&&Q(t.defaultValue))return t.defaultValue;if(typeof e==`function`)return``;if(Array.isArray(e)){let t=e[e.length-1];return typeof t==`function`?``:t}return e},ready:!1},Le=()=>()=>{},Re=(e,t={})=>{let{i18n:n}=t,{i18n:r,defaultNS:i}=(0,a.useContext)(Me)||{},o=n||r||Ae();o&&!o.reportNamespaces&&(o.reportNamespaces=new Ne),o||X(o,`NO_I18NEXT_INSTANCE`,`useTranslation: You will need to pass in an i18next instance by using initReactI18next`);let s=(0,a.useMemo)(()=>({...De(),...o?.options?.react,...t}),[o,t]),{useSuspense:c,keyPrefix:l}=s,u=e||i||o?.options?.defaultNS,d=Q(u)?[u]:u||[`translation`],f=(0,a.useMemo)(()=>d,d);o?.reportNamespaces?.addUsedNamespaces?.(f);let p=(0,a.useRef)(0),m=(0,a.useCallback)(e=>{if(!o)return Le;let{bindI18n:t,bindI18nStore:n}=s,r=()=>{p.current+=1,e()};return t&&o.on(t,r),n&&o.store.on(n,r),()=>{t&&t.split(` `).forEach(e=>o.off(e,r)),n&&n.split(` `).forEach(e=>o.store.off(e,r))}},[o,s]),h=(0,a.useRef)(),g=(0,a.useCallback)(()=>{if(!o)return Ie;let e=!!(o.isInitialized||o.initializedStoreOnce)&&f.every(e=>xe(e,o,s)),n=t.lng||o.language,r=p.current,i=h.current;if(i&&i.ready===e&&i.lng===n&&i.keyPrefix===l&&i.revision===r)return i;let a={t:o.getFixedT(n,s.nsMode===`fallback`?f:f[0],l,{scopeNs:f}),ready:e,lng:n,keyPrefix:l,revision:r};return h.current=a,a},[o,f,l,s,t.lng]),[_,v]=(0,a.useState)(0),{t:y,ready:b}=(0,Fe.useSyncExternalStore)(m,g,g);(0,a.useEffect)(()=>{if(o&&!b&&!c){let e=()=>v(e=>e+1);t.lng?be(o,t.lng,f,e):Z(o,f,e)}},[o,t.lng,f,b,c,_]);let x=o||{},S=(0,a.useRef)(null),C=(0,a.useRef)(),w=e=>{let t=Object.getOwnPropertyDescriptors(e);t.__original&&delete t.__original;let n=Object.create(Object.getPrototypeOf(e),t);if(!Object.prototype.hasOwnProperty.call(n,`__original`))try{Object.defineProperty(n,"__original",{value:e,writable:!1,enumerable:!1,configurable:!1})}catch{}return n},T=(0,a.useMemo)(()=>{let e=x,t=e?.language,n=e;e&&(S.current&&S.current.__original===e&&C.current===t?n=S.current:(n=w(e),S.current=n,C.current=t));let r=!b&&!c?(...e)=>(X(o,`USE_T_BEFORE_READY`,`useTranslation: t was called before ready. When using useSuspense: false, make sure to check the ready flag before using t.`),y(...e)):y,i=[r,n,b];return i.t=r,i.i18n=n,i.ready=b,i},[y,x,b,x.resolvedLanguage,x.language,x.languages]);if(o&&c&&!b)throw new Promise(e=>{let n=()=>e();t.lng?be(o,t.lng,f,n):Z(o,f,n)});return T};export{i as a,U as i,je as n,_e as r,Re as t};