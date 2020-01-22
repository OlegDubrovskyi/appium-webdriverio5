const timeout = 40000;

export class BaseComponent {
    safeClick(element: WebdriverIO.Element) {
        element.waitForDisplayed(timeout);
        element.click();
    }

    sendKeys(element: WebdriverIO.Element, value: any) {
        element.waitForDisplayed(timeout);
        element.clearValue();
        element.addValue(value);
    }

    safeClickByFirst(element: WebdriverIO.Element[]) {
        element[0].waitForDisplayed(timeout);
        element[0].click();
    }

    assertElementVisible(element: WebdriverIO.Element) {
        element.waitForDisplayed(timeout);
        expect(element.isDisplayed).toBeTruthy();
    }

    assertFirstElementVisible(element: WebdriverIO.Element[]) {
        element[0].waitForDisplayed(timeout);
        expect(element[0].isDisplayed).toBeTruthy();
    }

    assertElementContainsText(element: WebdriverIO.Element, text: string) {
        expect(element.getText()).toContain(text);
    }

    scrollByDirection(direction: string) {
        const windowSize: object = browser.getWindowSize();
        // @ts-ignore
        let fromTo: object = {from: { x: windowSize.width * 0.14, y: windowSize.height * 0.67}, to: {x: windowSize.width * 0.14, y: windowSize.height * 0.3}};
        //@ts-ignore
        if ((direction !== 'down')) {let from = fromTo.from; fromTo.from =  fromTo.to; fromTo.to = from;}
        $('android.widget.FrameLayout').touchAction([
            // @ts-ignore
            {action: 'press', x: fromTo.from.x, y: fromTo.from.y}, {action: 'wait', ms: 1000}, {action: 'moveTo', x: fromTo.from.x, y: fromTo.to.y}, {action: 'release'}
        ]);
    }

    swipeFromTo(from, to) {
        browser.touchPerform([{
            action: 'press',
            options: from,
        }, {
            action: 'wait',
            options: { ms: 2000 },
        }, {
            action: 'moveTo',

            options: to,
        }, {
            action: 'release',
        }]);
        browser.pause(1000);
    }

    scrollToElement(element: WebdriverIO.Element, direction) {
        let from;
        let to;
        const windowSize: object = browser._getWindowSize();
        switch (direction) {
            case 'down':
                // @ts-ignore
                from = { x: windowSize.width * 0.5, y: windowSize.height * 0.5 };
                // @ts-ignore
                to = { x: windowSize.width * 0.5, y: windowSize.height * 0.37 };
                break;
            case 'top':
                // @ts-ignore
                from = { x: windowSize.width * 0.5, y: windowSize.height * 0.37 };
                // @ts-ignore
                to = { x: windowSize.width * 0.5, y: windowSize.height * 0.5 };
                break;
        }
        for (let i = 0; i < 10; i++) {
            const test: any = element.isDisplayed();
            if (test === true) {
                break;
            }
            this.swipeFromTo(from, to);
        }
    }
}
