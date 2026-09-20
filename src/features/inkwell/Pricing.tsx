import { useState, type FormEvent } from 'react'

import { useGame } from '../../store'
import styles from './Pricing.module.css'
import { COUPON_CODE, formatCents, isUnknownCoupon, quoteCheckout } from './site'

/** Stripe's well-known test card — instantly recognisable as fake, exactly the point. */
const TEST_CARD = { number: '4242 4242 4242 4242', expiry: '12/34', cvc: '123' }

/**
 * inkwell.example/pricing: the single plan, and checkout right there on the same page (there's
 * only one plan, so there's no separate "choose a plan" step). The coupon math and its bug live
 * in `site.ts`; this component is just the form around it. See #17 and Ch 9-10 in planning.md.
 */
export function Pricing() {
  const cluster = useGame((s) => s.game.cluster)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [failed, setFailed] = useState(false)

  const quote = quoteCheckout(cluster, appliedCoupon ?? '')

  const applyCoupon = (code: string) => {
    setFailed(false)
    if (code.trim().length === 0) {
      setCouponError('Enter a coupon code.')
      setAppliedCoupon(null)
      return
    }
    if (isUnknownCoupon(code)) {
      setCouponError("That code isn't valid.")
      setAppliedCoupon(null)
      return
    }
    setCouponError(null)
    setAppliedCoupon(code)
  }

  /** The suggestion fills the field and applies it in one click — it's a shortcut, not a hint. */
  const useSuggestedCoupon = () => {
    setCouponInput(COUPON_CODE)
    applyCoupon(COUPON_CODE)
  }

  const onPay = (event: FormEvent) => {
    event.preventDefault()
    setFailed(quote.doubled)
    setPaid(!quote.doubled)
  }

  if (paid) {
    return (
      <div className={styles.confirmation}>
        <h1>Thanks!</h1>
        <p>You're subscribed to Inkwell Pro. A receipt is on its way to your inbox.</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.plan}>
        <h1>Inkwell Pro</h1>
        <p className={styles.price}>
          {formatCents(quote.subtotalCents)} <small>/ month</small>
        </p>
        <ul>
          <li>Unlimited documents</li>
          <li>Full-text search</li>
          <li>Version history</li>
        </ul>
      </div>

      <form className={styles.checkout} onSubmit={onPay}>
        <h2>Checkout</h2>

        {failed && (
          <p className={styles.banner} role="alert">
            Something went wrong. Please try again.
          </p>
        )}

        <div className={styles.row}>
          <input
            type="text"
            aria-label="Coupon code"
            placeholder="Coupon code"
            value={couponInput}
            onChange={(event) => {
              setCouponInput(event.target.value)
              setAppliedCoupon(null)
            }}
          />
          <button type="button" onClick={() => applyCoupon(couponInput)}>
            Apply
          </button>
        </div>
        {couponError ? (
          <p className={styles.couponError}>{couponError}</p>
        ) : (
          <button type="button" className={styles.suggestion} onClick={useSuggestedCoupon}>
            Have a code? Try {COUPON_CODE}.
          </button>
        )}

        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>{formatCents(quote.subtotalCents)}</span>
          </div>
          {quote.discountCents > 0 && (
            <div className={`${styles.summaryRow} ${styles.discount}`}>
              <span>Coupon ({COUPON_CODE})</span>
              <span>-{formatCents(quote.discountCents)}</span>
            </div>
          )}
          <div className={`${styles.summaryRow} ${styles.total}`}>
            <span>Total</span>
            <span>{formatCents(quote.totalCents)}</span>
          </div>
        </div>

        <div className={styles.fieldset}>
          <div className={styles.full}>
            <label htmlFor="card-number">Card number</label>
            <input id="card-number" type="text" defaultValue={TEST_CARD.number} />
          </div>
          <div>
            <label htmlFor="card-expiry">Expiry</label>
            <input id="card-expiry" type="text" defaultValue={TEST_CARD.expiry} />
          </div>
          <div>
            <label htmlFor="card-cvc">CVC</label>
            <input id="card-cvc" type="text" defaultValue={TEST_CARD.cvc} />
          </div>
        </div>

        <button type="submit" className={styles.pay}>
          Pay {formatCents(quote.totalCents)}
        </button>
      </form>
    </div>
  )
}
