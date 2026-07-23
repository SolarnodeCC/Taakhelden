/* @ds-bundle: {"format":4,"namespace":"TaakHeldenDesignSystem_73e756","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Field","sourcePath":"components/core/Field.jsx"},{"name":"Input","sourcePath":"components/core/Field.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"ProgressBar","sourcePath":"components/feedback/ProgressBar.jsx"},{"name":"AvatarBadge","sourcePath":"components/kids/AvatarBadge.jsx"},{"name":"PointsBadge","sourcePath":"components/kids/PointsBadge.jsx"},{"name":"RewardCard","sourcePath":"components/kids/RewardCard.jsx"},{"name":"StreakBadge","sourcePath":"components/kids/StreakBadge.jsx"},{"name":"TaskCard","sourcePath":"components/kids/TaskCard.jsx"},{"name":"SidebarNav","sourcePath":"components/navigation/SidebarNav.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"42d9f60e63a3","components/core/Button.jsx":"0cbaaa3657e6","components/core/Card.jsx":"bd1bda8a0f89","components/core/Field.jsx":"6dc3f86f8463","components/feedback/Alert.jsx":"7c4af9ba250f","components/feedback/ProgressBar.jsx":"0da57ea46ff6","components/kids/AvatarBadge.jsx":"f300c70fa5b0","components/kids/PointsBadge.jsx":"c14a9b16cdcf","components/kids/RewardCard.jsx":"71df06bbddf3","components/kids/StreakBadge.jsx":"091cb1ab0a3c","components/kids/TaskCard.jsx":"acb439e0f8a9","components/navigation/SidebarNav.jsx":"841e58b4334d","ui_kits/kid-app/MijnDagScreen.jsx":"1eec030a4499","ui_kits/kid-app/MijnHeldScreen.jsx":"86c32465458d","ui_kits/kid-app/TeenModeScreen.jsx":"30e6296dafcd","ui_kits/kid-app/WinkelScreen.jsx":"8d9e2626bbbd","ui_kits/kid-app/ios-frame.jsx":"24642b887be3","ui_kits/parent-dashboard/AppShell.jsx":"2d499c26b81a","ui_kits/parent-dashboard/screens/ApprovalsScreen.jsx":"bb011ca5540d","ui_kits/parent-dashboard/screens/InsightsScreen.jsx":"c5dc1fbf9a4b","ui_kits/parent-dashboard/screens/LoginScreen.jsx":"000331f45a2d","ui_kits/parent-dashboard/screens/ShopScreen.jsx":"70664ebd8f92","ui_kits/parent-dashboard/screens/TasksScreen.jsx":"daf0d31e1e07","ui_kits/parent-dashboard/screens/TodayScreen.jsx":"4628bbb9e03a"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TaakHeldenDesignSystem_73e756 = window.TaakHeldenDesignSystem_73e756 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
const tones = {
  neutral: {
    background: 'var(--color-surface)',
    color: 'var(--color-text-muted)'
  },
  accent: {
    background: 'var(--kid-turquoise-soft)',
    color: 'var(--color-accent-hover)'
  },
  success: {
    background: 'var(--color-success-bg)',
    color: 'var(--color-success)'
  },
  danger: {
    background: 'var(--color-danger-bg)',
    color: 'var(--color-danger)'
  }
};
function Badge({
  tone = 'neutral',
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      borderRadius: 'var(--radius-full)',
      padding: '0.125rem 0.625rem',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      fontFamily: 'var(--font-sans)',
      ...tones[tone]
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizes = {
  sm: {
    padding: '0.375rem 0.75rem',
    fontSize: 'var(--text-sm)'
  },
  md: {
    padding: '0.5rem 1rem',
    fontSize: 'var(--text-sm)'
  },
  lg: {
    padding: '0.75rem 1.5rem',
    fontSize: 'var(--text-base)'
  }
};
function variantStyle(variant) {
  switch (variant) {
    case 'secondary':
      return {
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)'
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--color-text)',
        border: '1px solid transparent'
      };
    case 'danger':
      return {
        background: 'var(--color-danger)',
        color: '#fff',
        border: '1px solid var(--color-danger)'
      };
    default:
      return {
        background: 'var(--color-accent)',
        color: 'var(--color-on-accent)',
        border: '1px solid var(--color-accent)'
      };
  }
}
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon = null,
  children,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const base = variantStyle(variant);
  const hoverBg = variant === 'primary' ? 'var(--color-accent-hover)' : variant === 'secondary' ? 'var(--color-surface)' : variant === 'ghost' ? 'var(--color-surface)' : base.background;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--weight-semibold)',
      borderRadius: 'var(--radius)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--transition-fast), opacity var(--transition-fast)',
      opacity: disabled ? 0.6 : 1,
      ...sizes[size],
      ...base,
      background: hover && !disabled ? hoverBg : base.background,
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  children,
  style,
  padded = true
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      padding: padded ? 'var(--space-5)' : 0,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Field({
  label,
  error,
  children
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--color-text)'
    }
  }, label, children, error && /*#__PURE__*/React.createElement("span", {
    role: "alert",
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-danger)',
      fontWeight: 'var(--weight-regular)'
    }
  }, error));
}
function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${error ? 'var(--color-danger)' : focus ? 'var(--color-accent)' : 'var(--color-border)'}`,
      background: 'var(--color-bg)',
      padding: '0.5rem 0.75rem',
      fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-sans)',
      color: 'var(--color-text)',
      outline: 'none',
      transition: 'border-color var(--transition-fast)'
    }
  }, rest));
}
Object.assign(__ds_scope, { Field, Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Field.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
function Alert({
  tone = 'danger',
  children
}) {
  const map = {
    danger: {
      color: 'var(--color-danger)',
      background: 'var(--color-danger-bg)'
    },
    success: {
      color: 'var(--color-success)',
      background: 'var(--color-success-bg)'
    }
  };
  const c = map[tone] || map.danger;
  return /*#__PURE__*/React.createElement("p", {
    role: "alert",
    style: {
      margin: 0,
      padding: '0.625rem 0.875rem',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-sans)',
      ...c
    }
  }, children);
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressBar.jsx
try { (() => {
function ProgressBar({
  value = 0,
  max = 100,
  tone = 'accent',
  label
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const fill = tone === 'kid' ? 'var(--kid-coral)' : 'var(--color-accent)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.375rem',
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '0.625rem',
      borderRadius: 'var(--radius-full)',
      background: 'var(--color-surface)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: pct + '%',
      height: '100%',
      background: fill,
      borderRadius: 'var(--radius-full)',
      transition: 'width var(--transition-base)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/kids/AvatarBadge.jsx
try { (() => {
const tones = {
  kid: {
    bg: 'var(--kid-turquoise-soft)',
    ring: 'var(--kid-turquoise)',
    badge: 'var(--kid-coral)'
  },
  teen: {
    bg: 'var(--teen-navy-surface)',
    ring: 'var(--teen-mint)',
    badge: 'var(--teen-mint)'
  }
};
function AvatarBadge({
  emoji = '🦊',
  level,
  size = 64,
  tone = 'kid'
}) {
  const c = tones[tone] || tones.kid;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: 'var(--radius-full)',
      background: c.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.5,
      border: `2px solid ${c.ring}`
    }
  }, emoji), level != null && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      background: c.badge,
      color: tone === 'teen' ? 'var(--teen-navy)' : '#fff',
      borderRadius: 'var(--radius-full)',
      width: '1.5rem',
      height: '1.5rem',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-bold)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid #fff',
      fontFamily: tone === 'teen' ? 'var(--font-sans)' : 'var(--font-rounded)'
    }
  }, level));
}
Object.assign(__ds_scope, { AvatarBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/kids/AvatarBadge.jsx", error: String((e && e.message) || e) }); }

// components/kids/PointsBadge.jsx
try { (() => {
function PointsBadge({
  points
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      background: 'var(--kid-yellow-soft)',
      color: '#8a5a00',
      borderRadius: 'var(--radius-full)',
      padding: '0.375rem 0.875rem',
      fontFamily: 'var(--font-rounded)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-base)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u2B50"), points, " punten");
}
Object.assign(__ds_scope, { PointsBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/kids/PointsBadge.jsx", error: String((e && e.message) || e) }); }

// components/kids/RewardCard.jsx
try { (() => {
function RewardCard({
  icon,
  title,
  price,
  affordable = true
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      alignItems: 'center',
      textAlign: 'center',
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: '1rem',
      fontFamily: 'var(--font-rounded)',
      boxShadow: 'var(--shadow-sm)',
      opacity: affordable ? 1 : 0.55
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '2rem'
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--kid-text)',
      fontSize: 'var(--text-base)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--kid-turquoise)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-sm)'
    }
  }, price, " punten"));
}
Object.assign(__ds_scope, { RewardCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/kids/RewardCard.jsx", error: String((e && e.message) || e) }); }

// components/kids/StreakBadge.jsx
try { (() => {
function StreakBadge({
  days
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      background: 'var(--kid-coral-soft)',
      color: '#a13a1f',
      borderRadius: 'var(--radius-full)',
      padding: '0.375rem 0.875rem',
      fontFamily: 'var(--font-rounded)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-base)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDD25"), days, " dagen op rij");
}
Object.assign(__ds_scope, { StreakBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/kids/StreakBadge.jsx", error: String((e && e.message) || e) }); }

// components/kids/TaskCard.jsx
try { (() => {
function TaskCard({
  icon,
  title,
  points,
  done = false,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      background: done ? 'var(--kid-turquoise-soft)' : '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: '0.875rem 1rem',
      fontFamily: 'var(--font-rounded)',
      boxShadow: 'var(--shadow-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '1.75rem',
      lineHeight: 1
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--kid-text)',
      textDecoration: done ? 'line-through' : 'none'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--kid-turquoise)',
      fontWeight: 'var(--weight-semibold)'
    }
  }, "+", points, " punten")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onToggle,
    "aria-pressed": done,
    style: {
      width: '2.75rem',
      height: '2.75rem',
      borderRadius: 'var(--radius-full)',
      cursor: 'pointer',
      background: done ? 'var(--kid-turquoise)' : '#fff',
      color: done ? '#fff' : 'var(--kid-turquoise)',
      border: done ? 'none' : '2px dashed var(--kid-turquoise)',
      opacity: done ? 1 : 0.6,
      fontSize: '1.25rem',
      fontWeight: 'var(--weight-bold)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, "\u2713"));
}
Object.assign(__ds_scope, { TaskCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/kids/TaskCard.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarNav.jsx
try { (() => {
function SidebarNav({
  items,
  activeKey,
  onNavigate
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      padding: '0 0.5rem',
      fontFamily: 'var(--font-sans)'
    }
  }, items.map(item => {
    const active = item.key === activeKey;
    return /*#__PURE__*/React.createElement("a", {
      key: item.key,
      onClick: () => onNavigate && onNavigate(item.key),
      style: {
        borderRadius: 'var(--radius-sm)',
        padding: '0.5rem 0.75rem',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-medium)',
        cursor: 'pointer',
        textDecoration: 'none',
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? 'var(--color-on-accent)' : 'var(--color-text)'
      }
    }, item.label);
  }));
}
Object.assign(__ds_scope, { SidebarNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/kid-app/MijnDagScreen.jsx
try { (() => {
function Confetti({
  burstKey
}) {
  if (!burstKey) return null;
  const pieces = Array.from({
    length: 14
  });
  const colors = ['var(--kid-coral)', 'var(--kid-turquoise)', 'var(--kid-yellow)'];
  return /*#__PURE__*/React.createElement("div", {
    key: burstKey,
    style: {
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 50
    }
  }, pieces.map((_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      position: 'absolute',
      left: '50%',
      top: '30%',
      width: 8,
      height: 8,
      background: colors[i % 3],
      borderRadius: i % 2 ? '50%' : 2,
      animation: `th-confetti-${i % 4} 700ms ease-out forwards`
    }
  })), /*#__PURE__*/React.createElement("style", null, `
        @keyframes th-confetti-0{to{transform:translate(-90px,120px) rotate(180deg);opacity:0}}
        @keyframes th-confetti-1{to{transform:translate(70px,140px) rotate(-160deg);opacity:0}}
        @keyframes th-confetti-2{to{transform:translate(-40px,160px) rotate(220deg);opacity:0}}
        @keyframes th-confetti-3{to{transform:translate(100px,90px) rotate(140deg);opacity:0}}
      `));
}
function MijnDagScreen() {
  const {
    TaskCard,
    PointsBadge,
    StreakBadge,
    AvatarBadge
  } = window.TaakHeldenDesignSystem_73e756;
  const [tasks, setTasks] = React.useState([{
    id: 1,
    icon: '🧹',
    title: 'Kamer opruimen',
    points: 10,
    done: false
  }, {
    id: 2,
    icon: '📚',
    title: 'Frans leren (15 min)',
    points: 15,
    done: true
  }, {
    id: 3,
    icon: '🐕',
    title: 'Hond eten geven',
    points: 5,
    done: false
  }]);
  const [burst, setBurst] = React.useState(0);
  function toggle(id) {
    setTasks(ts => ts.map(t => t.id === id ? {
      ...t,
      done: !t.done
    } : t));
    const t = tasks.find(x => x.id === id);
    if (t && !t.done) setBurst(b => b + 1);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--kid-cream)',
      minHeight: '100%',
      padding: '16px 16px 90px',
      fontFamily: 'var(--font-rounded)'
    }
  }, /*#__PURE__*/React.createElement(Confetti, {
    burstKey: burst
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(AvatarBadge, {
    emoji: "\uD83E\uDD8A",
    level: 4,
    size: 56
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(PointsBadge, {
    points: 380
  }), /*#__PURE__*/React.createElement(StreakBadge, {
    days: 12
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--kid-text)',
      marginBottom: 12
    }
  }, "Mijn Dag"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, tasks.map(t => /*#__PURE__*/React.createElement(TaskCard, {
    key: t.id,
    icon: t.icon,
    title: t.title,
    points: t.points,
    done: t.done,
    onToggle: () => toggle(t.id)
  }))));
}
window.MijnDagScreen = MijnDagScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/kid-app/MijnDagScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/kid-app/MijnHeldScreen.jsx
try { (() => {
function MijnHeldScreen() {
  const {
    AvatarBadge,
    Badge
  } = window.TaakHeldenDesignSystem_73e756;
  const badges = ['Eerste week vol!', '10 foto\'s gemaakt', 'Huiswerkkampioen'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--kid-cream)',
      minHeight: '100%',
      padding: '16px 16px 90px',
      fontFamily: 'var(--font-rounded)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--kid-text)',
      marginBottom: 16
    }
  }, "Mijn Held"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(AvatarBadge, {
    emoji: "\uD83E\uDD8A",
    level: 4,
    size: 96
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--kid-turquoise)',
      fontWeight: 'var(--weight-semibold)',
      marginBottom: 20
    }
  }, "Level 4 \u2014 TaakHeld"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      alignItems: 'center'
    }
  }, badges.map(b => /*#__PURE__*/React.createElement(Badge, {
    key: b,
    tone: "accent"
  }, "\uD83C\uDFC5 ", b))));
}
window.MijnHeldScreen = MijnHeldScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/kid-app/MijnHeldScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/kid-app/TeenModeScreen.jsx
try { (() => {
function TeenModeScreen() {
  const {
    TaskCard,
    PointsBadge,
    StreakBadge,
    AvatarBadge
  } = window.TaakHeldenDesignSystem_73e756;
  const tasks = [{
    id: 1,
    icon: '🍳',
    title: 'Koken helpen',
    points: 20,
    done: false
  }, {
    id: 2,
    icon: '🧺',
    title: 'Was draaien',
    points: 15,
    done: true
  }, {
    id: 3,
    icon: '📖',
    title: 'Huiswerkagenda bijwerken',
    points: 10,
    done: false
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--teen-navy)',
      minHeight: '100%',
      padding: '16px 16px 90px',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(AvatarBadge, {
    emoji: "\uD83E\uDDD1\uD83C\uDFFB",
    level: 8,
    size: 56,
    tone: "teen"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--teen-navy-surface)',
      color: 'var(--teen-mint)',
      borderRadius: 999,
      padding: '4px 12px',
      fontSize: 13,
      fontWeight: 600
    }
  }, "380 punten"), /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--teen-navy-surface)',
      color: 'var(--teen-muted)',
      borderRadius: 999,
      padding: '4px 12px',
      fontSize: 13,
      fontWeight: 600
    }
  }, "12 dagen op rij")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 700,
      color: 'var(--teen-text)',
      marginBottom: 12
    }
  }, "Mijn Dag"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, tasks.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: t.done ? 'var(--teen-navy-surface)' : 'var(--teen-navy-surface)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      opacity: 0.8
    }
  }, t.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--teen-text)',
      fontWeight: 600,
      fontSize: 15,
      textDecoration: t.done ? 'line-through' : 'none'
    }
  }, t.title), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--teen-mint)',
      fontSize: 13,
      fontWeight: 600
    }
  }, "+", t.points, " punten")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: t.done ? 'none' : '2px solid var(--teen-muted)',
      background: t.done ? 'var(--teen-mint)' : 'transparent',
      color: t.done ? 'var(--teen-navy)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700
    }
  }, "\u2713")))));
}
window.TeenModeScreen = TeenModeScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/kid-app/TeenModeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/kid-app/WinkelScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function WinkelScreen() {
  const {
    RewardCard,
    PointsBadge,
    ProgressBar
  } = window.TaakHeldenDesignSystem_73e756;
  const rewards = [{
    icon: '🎬',
    title: 'Film uitkiezen',
    price: 150,
    affordable: true
  }, {
    icon: '⏰',
    title: 'Extra schermtijd',
    price: 100,
    affordable: true
  }, {
    icon: '🏊',
    title: 'Zwembad',
    price: 500,
    affordable: false
  }, {
    icon: '🍕',
    title: 'Pizza-avond',
    price: 500,
    affordable: false
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--kid-cream)',
      minHeight: '100%',
      padding: '16px 16px 90px',
      fontFamily: 'var(--font-rounded)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--kid-text)'
    }
  }, "Winkel"), /*#__PURE__*/React.createElement(PointsBadge, {
    points: 380
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: 380,
    max: 500,
    tone: "kid",
    label: "Nog 120 punten tot het zwembad!"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, rewards.map(r => /*#__PURE__*/React.createElement(RewardCard, _extends({
    key: r.title
  }, r)))));
}
window.WinkelScreen = WinkelScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/kid-app/WinkelScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/kid-app/ios-frame.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
// Copied omelette starter. Re-running copy_starter_component with this kind overwrites this file with the latest version (page content is unaffected).

/* BEGIN USAGE */
// iOS.jsx — Simplified iOS 26 (Liquid Glass) device frame
// Based on the iOS 26 UI Kit + Figma status bar spec. No assets, no deps.
// Exports (to window): IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard
//
// Usage — wrap your screen content in <IOSDevice> to get the bezel, status bar
// and home indicator (props: title, dark, keyboard):
//
//   <IOSDevice title="Settings">
//     ...your screen content...
//   </IOSDevice>
//   <IOSDevice dark title="Search" keyboard>…</IOSDevice>
/* END USAGE */

// ─────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────
function IOSStatusBar({
  dark = false,
  time = '9:41'
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 154,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '21px 24px 19px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 20,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: '-apple-system, "SF Pro", system-ui',
      fontWeight: 590,
      fontSize: 17,
      lineHeight: '22px',
      color: c
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingTop: 1,
      paddingRight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "12",
    viewBox: "0 0 19 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7.5",
    width: "3.2",
    height: "4.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.8",
    y: "5",
    width: "3.2",
    height: "7",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.6",
    y: "2.5",
    width: "3.2",
    height: "9.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14.4",
    y: "0",
    width: "3.2",
    height: "12",
    rx: "0.7",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "12",
    viewBox: "0 0 17 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z",
    fill: c
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "10.5",
    r: "1.5",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "13",
    viewBox: "0 0 27 13"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "23",
    height: "12",
    rx: "3.5",
    stroke: c,
    strokeOpacity: "0.35",
    fill: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "9",
    rx: "2",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z",
    fill: c,
    fillOpacity: "0.4"
  }))));
}

// ─────────────────────────────────────────────────────────────
// Liquid glass pill — blur + tint + shine
// ─────────────────────────────────────────────────────────────
function IOSGlassPill({
  children,
  dark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      minWidth: 44,
      borderRadius: 9999,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Navigation bar — glass pills + large title
// ─────────────────────────────────────────────────────────────
function IOSNavBar({
  title = 'Title',
  dark = false,
  trailingIcon = true
}) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pillIcon = content => /*#__PURE__*/React.createElement(IOSGlassPill, {
    dark: dark
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, content));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 62,
      paddingBottom: 10,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "20",
    viewBox: "0 0 12 20",
    fill: "none",
    style: {
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2L2 10l8 8",
    stroke: muted,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), trailingIcon && pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "6",
    viewBox: "0 0 22 6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "3",
    r: "2.5",
    fill: muted
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      fontFamily: '-apple-system, system-ui',
      fontSize: 34,
      fontWeight: 700,
      lineHeight: '41px',
      color: text,
      letterSpacing: 0.4
    }
  }, title));
}

// ─────────────────────────────────────────────────────────────
// Grouped list (inset card, r:26) + row (52px)
// ─────────────────────────────────────────────────────────────
function IOSListRow({
  title,
  detail,
  icon,
  chevron = true,
  isLast = false,
  dark = false
}) {
  const text = dark ? '#fff' : '#000';
  const sec = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const ter = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const sep = dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 52,
      padding: '0 16px',
      position: 'relative',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      letterSpacing: -0.43
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: icon,
      marginRight: 12,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: text
    }
  }, title), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      color: sec,
      marginRight: 6
    }
  }, detail), chevron && /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "14",
    viewBox: "0 0 8 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l6 6-6 6",
    stroke: ter,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: icon ? 58 : 16,
      height: 0.5,
      background: sep
    }
  }));
}
function IOSList({
  header,
  children,
  dark = false
}) {
  const hc = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const bg = dark ? '#1C1C1E' : '#fff';
  return /*#__PURE__*/React.createElement("div", null, header && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: '-apple-system, system-ui',
      fontSize: 13,
      color: hc,
      textTransform: 'uppercase',
      padding: '8px 36px 6px',
      letterSpacing: -0.08
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 26,
      margin: '0 16px',
      overflow: 'hidden'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Device frame
// ─────────────────────────────────────────────────────────────
function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false
}) {
  return (
    /*#__PURE__*/
    // data-om-starter: inert presence marker — Claude Design's starter-usage
    // probe reads it; it renders nothing. Keep it on this root element.
    React.createElement("div", {
      "data-om-starter": "ios-frame",
      style: {
        width,
        height,
        borderRadius: 48,
        overflow: 'hidden',
        position: 'relative',
        background: dark ? '#000' : '#F2F2F7',
        boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
        fontFamily: '-apple-system, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 11,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 126,
        height: 37,
        borderRadius: 24,
        background: '#000',
        zIndex: 50
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10
      }
    }, /*#__PURE__*/React.createElement(IOSStatusBar, {
      dark: dark
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }
    }, title !== undefined && /*#__PURE__*/React.createElement(IOSNavBar, {
      title: title,
      dark: dark
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflow: 'auto'
      }
    }, children), keyboard && /*#__PURE__*/React.createElement(IOSKeyboard, {
      dark: dark
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        height: 34,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingBottom: 8,
        pointerEvents: 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 139,
        height: 5,
        borderRadius: 100,
        background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'
      }
    })))
  );
}

// ─────────────────────────────────────────────────────────────
// Keyboard — iOS 26 liquid glass
// ─────────────────────────────────────────────────────────────
function IOSKeyboard({
  dark = false
}) {
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959';
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333';
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';

  // special-key icons
  const icons = {
    shift: /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "17",
      viewBox: "0 0 19 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z",
      fill: glyph
    })),
    del: /*#__PURE__*/React.createElement("svg", {
      width: "23",
      height: "17",
      viewBox: "0 0 23 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z",
      fill: "none",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 5l7 7M17 5l-7 7",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    ret: /*#__PURE__*/React.createElement("svg", {
      width: "20",
      height: "14",
      viewBox: "0 0 20 14"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 1v6H4m0 0l4-4M4 7l4 4",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  const key = (content, {
    w,
    flex,
    ret,
    fs = 25,
    k
  } = {}) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      height: 42,
      borderRadius: 8.5,
      flex: flex ? 1 : undefined,
      width: w,
      minWidth: 0,
      background: ret ? '#08f' : keyBg,
      boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Compact", system-ui',
      fontSize: fs,
      fontWeight: 458,
      color: ret ? '#fff' : glyph
    }
  }, content);
  const row = (keys, pad = 0) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      justifyContent: 'center',
      padding: `0 ${pad}px`
    }
  }, keys.map(l => key(l, {
    flex: true,
    k: l
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 15,
      borderRadius: 27,
      overflow: 'hidden',
      padding: '11px 0 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: dark ? '0 -2px 20px rgba(0,0,0,0.09)' : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      padding: '8px 22px 13px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, ['"The"', 'the', 'to'].map((w, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 25,
      background: '#ccc',
      opacity: 0.3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      color: sugg,
      letterSpacing: -0.43,
      lineHeight: '22px'
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      padding: '0 6.5px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']), row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14.25,
      alignItems: 'center'
    }
  }, key(icons.shift, {
    w: 45,
    k: 'shift'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      flex: 1
    }
  }, ['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(l => key(l, {
    flex: true,
    k: l
  }))), key(icons.del, {
    w: 45,
    k: 'del'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, key('ABC', {
    w: 92.25,
    fs: 18,
    k: 'abc'
  }), key('', {
    flex: true,
    k: 'space'
  }), key(icons.ret, {
    w: 92.25,
    ret: true,
    k: 'ret'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      width: '100%',
      position: 'relative'
    }
  }));
}
Object.assign(window, {
  IOSDevice,
  IOSStatusBar,
  IOSNavBar,
  IOSGlassPill,
  IOSList,
  IOSListRow,
  IOSKeyboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/kid-app/ios-frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/parent-dashboard/AppShell.jsx
try { (() => {
function AppShell({
  active,
  onNavigate,
  children
}) {
  const {
    SidebarNav
  } = window.TaakHeldenDesignSystem_73e756;
  const items = [{
    key: 'vandaag',
    label: 'Vandaag'
  }, {
    key: 'goedkeuren',
    label: 'Goedkeuren'
  }, {
    key: 'taken',
    label: 'Taken'
  }, {
    key: 'winkel',
    label: 'Winkel'
  }, {
    key: 'inzichten',
    label: 'Inzichten'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100vh',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 240,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--color-border)',
      background: 'var(--color-surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 20px',
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-accent)'
    }
  }, "TaakHelden"), /*#__PURE__*/React.createElement(SidebarNav, {
    items: items,
    activeKey: active,
    onNavigate: onNavigate
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      borderBottom: '1px solid var(--color-border)',
      padding: '16px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-text)'
    }
  }, "Familie Bakker"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-muted)'
    }
  }, "Hoi Merel")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("select", {
    style: {
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '4px 8px',
      fontSize: 'var(--text-xs)'
    }
  }, /*#__PURE__*/React.createElement("option", null, "NL"), /*#__PURE__*/React.createElement("option", null, "EN")), /*#__PURE__*/React.createElement("button", {
    style: {
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '6px 12px',
      fontSize: 'var(--text-sm)',
      background: 'var(--color-bg)',
      cursor: 'pointer'
    }
  }, "Uitloggen"))), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      padding: '32px 24px'
    }
  }, children)));
}
window.AppShell = AppShell;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/parent-dashboard/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/parent-dashboard/screens/ApprovalsScreen.jsx
try { (() => {
function ApprovalsScreen() {
  const {
    Card,
    Badge,
    Button
  } = window.TaakHeldenDesignSystem_73e756;
  const [items, setItems] = React.useState([{
    id: 1,
    child: 'Sam',
    task: 'Vaatwasser uitruimen',
    points: 15,
    photo: true
  }, {
    id: 2,
    child: 'Noor',
    task: 'Huiswerk Frans',
    points: 20,
    photo: false
  }]);
  function resolve(id) {
    setItems(its => its.filter(i => i.id !== id));
  }
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 640,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, "Goedkeuren"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginTop: 16
    }
  }, items.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--color-text-muted)',
      fontSize: 'var(--text-sm)'
    }
  }, "Alles is bijgewerkt \u2014 niets wacht op goedkeuring."), items.map(i => /*#__PURE__*/React.createElement(Card, {
    key: i.id
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 'var(--weight-medium)',
      color: 'var(--color-text)'
    }
  }, i.child, " \u2014 ", i.task), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-muted)',
      marginTop: 2
    }
  }, "+", i.points, " punten", i.photo ? ' · foto ingestuurd' : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    onClick: () => resolve(i.id)
  }, "Opnieuw"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary",
    onClick: () => resolve(i.id)
  }, "Goedkeuren")))))));
}
window.ApprovalsScreen = ApprovalsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/parent-dashboard/screens/ApprovalsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/parent-dashboard/screens/InsightsScreen.jsx
try { (() => {
function InsightsScreen() {
  const {
    Card,
    ProgressBar
  } = window.TaakHeldenDesignSystem_73e756;
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 640,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, "Inzichten"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-muted)',
      marginTop: 4
    }
  }, "Als hulp voor het gesprek \u2014 nooit als controlemiddel."), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: 82,
    max: 100,
    label: "Sam \u2014 taken afgerond deze week (82%)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    value: 95,
    max: 100,
    label: "Noor \u2014 taken afgerond deze week (95%)"
  })));
}
window.InsightsScreen = InsightsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/parent-dashboard/screens/InsightsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/parent-dashboard/screens/LoginScreen.jsx
try { (() => {
function LoginScreen({
  onLogin
}) {
  const {
    Button,
    Field,
    Input,
    Alert
  } = window.TaakHeldenDesignSystem_73e756;
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState(null);
  function submit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Vul een geldig e-mailadres en wachtwoord in.');
      return;
    }
    setError(null);
    onLogin();
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("main", {
    style: {
      width: '100%',
      maxWidth: 360
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 4,
      borderRadius: 999,
      background: 'var(--color-accent)',
      marginBottom: 20
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-accent)',
      margin: 0
    }
  }, "TaakHelden"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 4,
      fontSize: 'var(--text-sm)',
      color: 'var(--color-text-muted)'
    }
  }, "Log in om het dashboard van je gezin te bekijken."), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    style: {
      marginTop: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "E-mailadres"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "email",
    placeholder: "jij@gezin.nl",
    value: email,
    onChange: e => setEmail(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Wachtwoord"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value)
  })), error && /*#__PURE__*/React.createElement(Alert, {
    tone: "danger"
  }, error), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    style: {
      marginTop: 4
    },
    onClick: submit
  }, "Inloggen")))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: 'var(--color-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderLeft: '1px solid var(--color-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      alignItems: 'center',
      color: 'var(--color-text-muted)',
      fontSize: 'var(--text-sm)',
      textAlign: 'center',
      maxWidth: 280
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 48
    }
  }, "\uD83C\uDFC6"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0
    }
  }, "Overzicht van taken, punten en goedkeuringen \u2014 voor het hele gezin."))));
}
window.LoginScreen = LoginScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/parent-dashboard/screens/LoginScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/parent-dashboard/screens/ShopScreen.jsx
try { (() => {
function ShopScreen() {
  const {
    Card,
    Button,
    Badge
  } = window.TaakHeldenDesignSystem_73e756;
  const rewards = [{
    icon: '🎬',
    title: 'Film uitkiezen',
    price: 150
  }, {
    icon: '⏰',
    title: '30 min extra schermtijd',
    price: 100
  }, {
    icon: '🏊',
    title: 'Uitje naar het zwembad',
    price: 500
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 640,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, "Winkel"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary"
  }, "+ Nieuwe beloning")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 16
    }
  }, rewards.map(r => /*#__PURE__*/React.createElement(Card, {
    key: r.title,
    padded: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, r.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontWeight: 'var(--weight-medium)',
      color: 'var(--color-text)'
    }
  }, r.title), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, r.price, " pt"))))));
}
window.ShopScreen = ShopScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/parent-dashboard/screens/ShopScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/parent-dashboard/screens/TasksScreen.jsx
try { (() => {
function TasksScreen() {
  const {
    Card,
    Badge,
    Button
  } = window.TaakHeldenDesignSystem_73e756;
  const tasks = [{
    icon: '🧹',
    title: 'Kamer opruimen',
    freq: 'Dagelijks',
    points: 10
  }, {
    icon: '📚',
    title: 'Huiswerkplanning',
    freq: 'Weekdagen',
    points: 15
  }, {
    icon: '🍽️',
    title: 'Tafel afruimen',
    freq: 'Dagelijks',
    points: 5
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 640,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, "Taken"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary"
  }, "+ Nieuwe taak")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 16
    }
  }, tasks.map(t => /*#__PURE__*/React.createElement(Card, {
    key: t.title,
    padded: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, t.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 'var(--weight-medium)',
      color: 'var(--color-text)'
    }
  }, t.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-muted)'
    }
  }, t.freq)), /*#__PURE__*/React.createElement(Badge, {
    tone: "accent"
  }, "+", t.points, " pt"))))));
}
window.TasksScreen = TasksScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/parent-dashboard/screens/TasksScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/parent-dashboard/screens/TodayScreen.jsx
try { (() => {
function TodaySkeletonRow() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 14,
      borderRadius: 4,
      background: 'var(--color-surface)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 20,
      borderRadius: 999,
      background: 'var(--color-surface)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 20,
      borderRadius: 999,
      background: 'var(--color-surface)'
    }
  })));
}
function TodayScreen() {
  const {
    Card,
    Badge
  } = window.TaakHeldenDesignSystem_73e756;
  const kids = [{
    name: 'Sam',
    open: 2,
    done: 3,
    waiting: 1
  }, {
    name: 'Noor',
    open: 0,
    done: 5,
    waiting: 0
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 640,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, "Vandaag"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginTop: 16
    }
  }, kids.map(k => /*#__PURE__*/React.createElement(Card, {
    key: k.name
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--color-text)'
    }
  }, k.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, k.open === 0 && k.waiting === 0 ? /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "Alle taken af! \uD83C\uDF89") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, k.open, " open"), /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, k.done, " af"), k.waiting > 0 && /*#__PURE__*/React.createElement(Badge, {
    tone: "accent"
  }, k.waiting, " wacht op goedkeuring")))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-muted)',
      marginBottom: 4
    }
  }, "Laden\u2026"), /*#__PURE__*/React.createElement(TodaySkeletonRow, null))));
}
window.TodayScreen = TodayScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/parent-dashboard/screens/TodayScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.AvatarBadge = __ds_scope.AvatarBadge;

__ds_ns.PointsBadge = __ds_scope.PointsBadge;

__ds_ns.RewardCard = __ds_scope.RewardCard;

__ds_ns.StreakBadge = __ds_scope.StreakBadge;

__ds_ns.TaskCard = __ds_scope.TaskCard;

__ds_ns.SidebarNav = __ds_scope.SidebarNav;

})();
