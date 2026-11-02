# @pen-ink/react

React components drawn in real time in pen and ink: buttons, cards, inputs that write as you type, handwriting, and page turns. They're semantic HTML underneath.

```sh
npm install @pen-ink/react
```

```tsx
import { InkProvider, InkButton, Handwriting } from '@pen-ink/react';
import '@pen-ink/react/styles.css';

<InkProvider>
  <Handwriting as="h1" hand="allure" nib="dip">Hello</Handwriting>
  <InkButton variant="solid">Save</InkButton>
</InkProvider>
```

The full documentation is in the [project README](../../README.md).
