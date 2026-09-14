
@media (hover: none) and (pointer: coarse) {
  button,
  input,
  select,
  .navButton,
  .viewButton {
    touch-action: manipulation;
  }

  .themeButton,
  #accountButton,
  .navButton,
  .pager button {
    min-height: 44px;
  }

  [data-tooltip]::before,
  [data-tooltip]::after,
  [data-note-tooltip]::before,
  [data-note-tooltip]::after {
    pointer-events: none;
  }
}
