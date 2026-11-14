"""Exact full port tuples, not equality supplied by an injected object.

Every caller rereads its current ports. This compares their ownership only;
it stores no authority, parameter, source value, result or previous verdict.
"""
from types import MethodType

def retain_cleanup_owners(existing,owners):
    """Pin explicit typed dependencies at first admitted source use.

    Test/source assembly may supply a dependency after construction but before
    its first request. Keep that exact owner and its class cleanup code, never
    infer later replacement ownership while an operation is unwinding.
    """
    from .source_inputs import MemorySourceInputs
    from .source_credentials import SourceCredentialResources
    from .source_timing import SourcePolicyWorker
    from .retirement import RetirementBirths
    from .validation import Refusal
    allowed=(MemorySourceInputs,SourceCredentialResources,SourcePolicyWorker,RetirementBirths)
    result=list(existing)
    for owner in owners:
        if owner is None:continue
        if type(owner) not in allowed:raise Refusal('binding_denied')
        if not any(owner is old for old,_ in result):result.append((owner,type(owner).close))
    return tuple(result)


def same_ports(expected: object, current: object) -> bool:
    if type(expected) is not tuple or type(current) is not tuple or len(expected)!=len(current):return False
    for old,new in zip(expected,current):
        if old is new:continue
        if type(old) is not MethodType or type(new) is not MethodType or old.__self__ is not new.__self__ or old.__func__ is not new.__func__:
            return False
    return True


def same_identities(expected: object, current: object) -> bool:
    if type(expected) is not tuple or type(current) is not tuple or len(expected)!=len(current):return False
    for old,new in zip(expected,current):
        if old is not new:return False
    return True
