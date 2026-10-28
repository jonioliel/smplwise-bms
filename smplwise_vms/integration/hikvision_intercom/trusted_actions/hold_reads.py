"""Read-only source-shaped hold/program projection; all window writes stay OFF."""
from .validation import Refusal

class HoldReads:
    def __init__(self,current_drafts,current_programs,current_timezone):
        if not all(callable(x) for x in (current_drafts,current_programs,current_timezone)):raise ValueError('explicit read owners required')
        self.drafts,self.programs,self.timezone=current_drafts,current_programs,current_timezone
    async def execute(self,action,params,context):
        context.check();providers=(self.drafts,self.programs,self.timezone)
        drafts,programs,zone=self.drafts(),self.programs(),self.timezone()
        station=params['station_id']
        if action=='stations/technical_hold_get':
            result={'draft':drafts.get(station,params['door']),'active':False,'blocker':'schedule_writes_unverified','timezone':zone}
        elif action=='stations/technical_program_list':
            result={'programs':programs.listing(station),'saved':[item for door in (1,2) if (item:=drafts.get(station,door)) is not None],'timezone':zone,'native_supported':False}
        else:raise Refusal('unknown_action')
        context.check()
        if any(a is not b for a,b in zip(providers,(self.drafts,self.programs,self.timezone))) or self.drafts()is not drafts or self.programs()is not programs or self.timezone()!=zone:raise Refusal('binding_denied')
        return result
