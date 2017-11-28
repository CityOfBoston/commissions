// @flow
/* global Stripe */

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import Cart from '../../store/Cart';
import Order from '../../models/Order';

import appLayoutDecorator from '../../../storybook/app-layout-decorator';

import PaymentContent from './PaymentContent';

import {
  TYPICAL_CERTIFICATE,
  PENDING_CERTIFICATE,
  NO_DATE_CERTIFICATE,
} from '../../../fixtures/client/death-certificates';

const makeStripe = () => (typeof Stripe !== 'undefined' ? Stripe('') : null);

function makeCart() {
  const cart = new Cart();

  cart.add(TYPICAL_CERTIFICATE, 1);
  cart.add(PENDING_CERTIFICATE, 3);
  cart.add(NO_DATE_CERTIFICATE, 1);

  return cart;
}

function makeShippingCompleteOrder(overrides = {}) {
  return new Order({
    storeContactAndShipping: true,
    storeBilling: false,

    contactName: 'Squirrel Girl',
    contactEmail: 'squirrel.girl@avengers.org',
    contactPhone: '(555) 123-9999',

    shippingName: 'Doreen Green',
    shippingCompanyName: 'Empire State University',
    shippingAddress1: 'Dorm Hall, Apt 5',
    shippingAddress2: '10 College Avenue',
    shippingCity: 'New York',
    shippingState: 'NY',
    shippingZip: '12345',

    cardholderName: 'Nancy Whitehead',
    cardToken: 'tok_testtoken',
    cardLast4: '4040',

    billingAddressSameAsShippingAddress: true,

    billingAddress1: '',
    billingAddress2: '',
    billingCity: '',
    billingState: '',
    billingZip: '',

    ...overrides,
  });
}

function makeBillingCompleteOrder(overrides = {}) {
  return makeShippingCompleteOrder({
    billingAddressSameAsShippingAddress: false,

    billingAddress1: '3 Avengers Towers',
    billingAddress2: '',
    billingCity: 'New York',
    billingState: 'NY',
    billingZip: '12223',
    ...overrides,
  });
}

storiesOf('PaymentContent', module)
  .addDecorator(appLayoutDecorator(null))
  .add('default', () => (
    <PaymentContent
      cart={makeCart()}
      stripe={makeStripe()}
      order={makeShippingCompleteOrder()}
      submit={action('submit')}
    />
  ))
  .add('credit card error', () => (
    <PaymentContent
      cart={makeCart()}
      stripe={makeStripe()}
      order={(() => {
        const order = makeBillingCompleteOrder();
        order.cardElementError = 'Your card number is incomplete.';

        return order;
      })()}
      submit={action('submit')}
      showErrorsForTest
    />
  ))
  .add('state error', () => (
    <PaymentContent
      cart={makeCart()}
      stripe={makeStripe()}
      order={makeBillingCompleteOrder({
        billingState: '??',
      })}
      submit={action('submit')}
      showErrorsForTest
    />
  ))
  .add('Stripe error', () => (
    <PaymentContent
      cart={makeCart()}
      stripe={makeStripe()}
      order={(() => {
        const order = makeBillingCompleteOrder();
        order.processingError = 'The card could not be tokenized.';

        return order;
      })()}
      submit={action('submit')}
      showErrorsForTest
    />
  ))
  .add('existing billing', () => (
    <PaymentContent
      cart={makeCart()}
      stripe={makeStripe()}
      order={makeBillingCompleteOrder()}
      submit={action('submit')}
    />
  ));
