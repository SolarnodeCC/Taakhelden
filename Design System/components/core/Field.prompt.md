Labeled form field (Field) and bordered text input (Input), copied 1:1 from the login form's markup.

```jsx
<Field label="E-mailadres">
  <Input type="email" placeholder="jij@gezin.nl" />
</Field>
<Field label="Wachtwoord" error="Vul een geldig wachtwoord in.">
  <Input type="password" error />
</Field>
```

Focus ring is teal (`--color-accent`); error state turns the border/text red.
