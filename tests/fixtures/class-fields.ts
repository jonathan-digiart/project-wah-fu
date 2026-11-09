let setterCalls = 0;
class Base {
  set value(_value: number) {
    setterCalls += 1;
  }
}
class Derived extends Base {
  // Deliberately shadow an accessor to distinguish define from assignment.
  // @ts-expect-error This is an intentional runtime compatibility fixture.
  value = 42;
}
const instance = new Derived();
document.querySelector("#result")!.textContent = JSON.stringify({
  value: instance.value,
  setterCalls,
  own: Object.hasOwn(instance, "value"),
});
