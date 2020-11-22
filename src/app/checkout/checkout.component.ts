import { Component, HostListener, Input, OnInit } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { Observable } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ICheckoutSessionId } from '../services/api.model';
import { ApiService } from '../services/api.service';

declare var StripeCheckout: StripeCheckoutStatic;

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {

  constructor(private authService: MsalService, private apiService: ApiService) { }

  @Input() amount;
  @Input() description;

  handler: StripeCheckoutHandler;
  stripe: stripe.Stripe;

  confirmation: any;
  loading = false;

  ngOnInit(): void {

    const stripe_key = environment.stripe_key;

    const stripeOption: stripe.StripeOptions = {
      locale: 'auto',
    };

    this.stripe  = Stripe(stripe_key, stripeOption);

    // this.handler = StripeCheckout.configure({
    //   key: environment.stripe_key,
    //   image: 'https://www.bim42.com/assets/BIM42_Logo_Embossed_7_FondNoir.png',
    //   locale: 'auto',
    //   source: async (source) => {
    //     this.loading = true;
    //     const account = await this.authService.getAccount();
    //     // const fun = this.functions.httpsCallable('stripeCreateCharge');
    //     // this.confirmation = await fun({ source: source.id, uid: account.sid, amount: this.amount }).toPromise();
    //     this.loading = false;
    //   }
    // });
  }

    // Open the checkout handler
    async checkout(event: MouseEvent ) {
      const account = await this.authService.getAccount();

      const createCheckoutSession: Observable<ICheckoutSessionId> = this.apiService.createCheckoutSession();

      const redirectToCheckout = (sessionId: ICheckoutSessionId): Promise<{ error: stripe.Error; }> => {

        const stripeServerCheckoutOptions: stripe.StripeServerCheckoutOptions = {
          sessionId: sessionId.id
        };
        return this.stripe.redirectToCheckout(stripeServerCheckoutOptions);
      };

      const processCheckoutResult = (checkoutError: { error: stripe.Error; }): string => {
        if (checkoutError) {
          alert(checkoutError.error.message);
          return checkoutError.error.message;
        } else {
          return 'No checkoutError';
        }
      };

      createCheckoutSession.pipe(
        flatMap((sessionId: ICheckoutSessionId) => redirectToCheckout(sessionId)),
        flatMap((checkoutError: { error: stripe.Error; }) => processCheckoutResult(checkoutError))
      )
      .subscribe(
        (result) => { console.log(result); },
        (error) => { console.log(error); }
        );

      event.preventDefault();
    }

    // Close on navigate
    @HostListener('window:popstate')
    onPopstate() {
      this.handler.close();
    }

}
