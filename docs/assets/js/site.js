const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelector('.nav-toggle')?.addEventListener('click', (event) => {
  const button = event.currentTarget;
  const open = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!open));
  document.querySelector('#primary-nav')?.classList.toggle('is-open', !open);
});

if (!reduceMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -48px' });

  document.querySelectorAll('.reveal, .stagger').forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll('.reveal, .stagger').forEach((element) => element.classList.add('is-visible'));
}

document.querySelectorAll('pre.highlight').forEach((block) => {
  const button = document.createElement('button');
  button.className = 'copy-code';
  button.type = 'button';
  button.textContent = 'Copy';
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(block.innerText);
    button.textContent = 'Copied';
    window.setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
  block.append(button);
});
